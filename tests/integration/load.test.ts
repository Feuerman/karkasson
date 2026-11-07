import { describe, expect, it } from 'vitest'
import { SocketEvents } from '@server/modules/types'
import { TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import { sleep } from './helpers/wait'
import { startTestServer, type RunningServer } from './helpers/server'
import { createLobby } from './helpers/lobby'

/**
 * Нагрузочное тестирование сервера: много одновременных игр и сокетов,
 * длинные партии, одновременные сохранения, профилирование памяти и event loop.
 *
 * Сценарий:
 * 1. Поднимает один реальный игровой сервер (in-memory хранилище).
 * 2. Создаёт несколько лобби параллельно — каждое со своим сокетом (TestClient).
 * 3. Запускает полностью автоматические партии: компьютеры разыгрывают колоду
 *    до конца, каждый ход сохраняет состояние — нагрузка на сохранения и
 *    цикл событий. Запуск компьютерных партий разносится во времени, чтобы
 *    не упираться в лимит стартов ИИ с одного IP (burst 3, дозаправка 1/мин).
 * 4. Измеряет RSS/heap памяти и задержку event loop до, во время и после
 *    нагрузки, проверяя, что нет утечки и event loop не застывает.
 * 5. Дожидается завершения всех партий и проверяет, что каждое состояние
 *    сохранено в базе и игра завершена.
 */

interface LoadResult {
  gameId: string
  client: TestClient
  placedTiles: number
  moveCounter: number
  gameIsEnded: boolean
}

// Лимит стартов компьютерных партий с одного IP: burst 3. Больше — rate limit.
const GAMES = 2
const START_STAGGER_MS = 1500

/** Замер задержки event loop: насколько реальный тик отстаёт от запланированного. */
function measureEventLoopLag(sampleMs = 100): Promise<number> {
  return new Promise<number>((resolve) => {
    const start = process.hrtime.bigint()
    setTimeout(() => {
      const actual = process.hrtime.bigint() - start
      const expected = BigInt(sampleMs) * 1_000_000n
      const lagMs = Number(actual - expected) / 1e6
      resolve(Math.max(0, lagMs))
    }, sampleMs)
  })
}

function rssMb(): number {
  return process.memoryUsage().rss / 1_048_576
}

function heapUsedMb(): number {
  return process.memoryUsage().heapUsed / 1_048_576
}

describe('Нагрузочное тестирование: много игр и сокетов', () => {
  let server: RunningServer | undefined
  const clients: TestClient[] = []

  registerIntegrationCleanup({
    getServer: () => server,
    clearServer: () => {
      server = undefined
    },
    disposeClients: () => {
      for (const client of clients) client.dispose()
      clients.length = 0
    },
  })

  it(`создаёт ${GAMES} автоматических партий, играет их до конца и не теряет состояние`, async () => {
    server = await startTestServer()
    const srv = server

    const rssBefore = rssMb()
    const heapBefore = heapUsedMb()
    const lagBefore = await measureEventLoopLag()

    // Создаём все лобби параллельно: много сокетов и партий сразу.
    const created = await Promise.all(
      Array.from({ length: GAMES }, (_, index) =>
        createLobby(srv.url, {
          identity: `load-client-${index}`,
          computerOnly: true,
        }).then(({ gameId, creator }) => {
          clients.push(creator)
          return { gameId, client: creator }
        })
      )
    )

    const results: LoadResult[] = []
    const errors: unknown[] = []

    // Запускаем компьютерные партии с разрывами: иначе лимит стартов ИИ с
    // одного IP (burst 3) отклонит часть команд StartGame.
    for (let index = 0; index < created.length; index += 1) {
      const { gameId, client } = created[index]
      if (index > 0) await sleep(START_STAGGER_MS)

      try {
        client.emit(SocketEvents.StartGame, { gameId })

        await client.waitForEvent<GameStateSnapshotLike>(
          SocketEvents.GameUpdated,
          (game) => game.gameIsEnded === true,
          180_000
        )

        const saved = await srv.db.getGame(gameId)
        const finalState = saved as unknown as GameStateSnapshotLike

        results.push({
          gameId,
          client,
          placedTiles: countPlacedTiles(finalState.tilePlacesStats),
          moveCounter: finalState.moveCounter ?? 0,
          gameIsEnded: finalState.gameIsEnded === true,
        })
      } catch (error) {
        errors.push(error)
      }
    }

    // Даём оставшимся сохранениям и таймерам компьютера доработать.
    await sleep(500)

    const rssAfter = rssMb()
    const heapAfter = heapUsedMb()
    const lagAfter = await measureEventLoopLag()
    const storage = srv.handle.gameService.storageStatus()

    expect(errors).toEqual([])
    expect(results.length).toBe(GAMES)
    for (const result of results) {
      expect(result.gameIsEnded).toBe(true)
      expect(result.moveCounter).toBeGreaterThan(0)
      expect(result.placedTiles).toBeGreaterThan(60)
      expect(result.placedTiles).toBeLessThanOrEqual(102)
    }

    // Каждая игра сохранена в базе.
    for (const result of results) {
      const saved = await srv.db.getGame(result.gameId)
      expect(saved).not.toBeNull()
      expect((saved as unknown as GameStateSnapshotLike).gameIsEnded).toBe(true)
    }

    // Память не раздулась бесконтрольно.
    const rssGrowth = rssAfter - rssBefore
    const heapGrowth = heapAfter - heapBefore
    expect(rssGrowth).toBeLessThan(300)
    expect(heapGrowth).toBeLessThan(200)

    // Event loop не застыл под нагрузкой.
    expect(lagAfter).toBeLessThan(Math.max(lagBefore * 5 + 50, 150))

    // Очередь сохранений опустела после окончания нагрузки.
    expect(storage.pendingSaves).toBe(0)
    expect(storage.pendingSaveOperations).toBe(0)

    // eslint-disable-next-line no-console
    console.log(
      `[load] games=${GAMES} rssBefore=${rssBefore.toFixed(1)}MB ` +
        `rssAfter=${rssAfter.toFixed(1)}MB growth=${rssGrowth.toFixed(1)}MB ` +
        `heapGrowth=${heapGrowth.toFixed(1)}MB ` +
        `lagBefore=${lagBefore.toFixed(1)}ms lagAfter=${lagAfter.toFixed(1)}ms ` +
        `pendingSaves=${storage.pendingSaves} saveFailures=${storage.saveFailures}`
    )
  }, 300_000)

  it(`поддерживает одновременные сохранения при ${GAMES} партиях`, async () => {
    server = await startTestServer()
    const srv = server

    const created = await Promise.all(
      Array.from({ length: GAMES }, (_, index) =>
        createLobby(srv.url, {
          identity: `save-client-${index}`,
          computerOnly: true,
        }).then(({ gameId, creator }) => {
          clients.push(creator)
          return { gameId, client: creator }
        })
      )
    )

    // Запускаем партии с разрывами из-за лимита стартов ИИ.
    for (let index = 0; index < created.length; index += 1) {
      const { gameId, client } = created[index]
      if (index > 0) await sleep(START_STAGGER_MS)
      client.emit(SocketEvents.StartGame, { gameId })
    }

    // Дожидаемся окончания всех партий.
    await Promise.all(
      created.map(async ({ client }) => {
        await client.waitForEvent<GameStateSnapshotLike>(
          SocketEvents.GameUpdated,
          (game) => game.gameIsEnded === true,
          180_000
        )
      })
    )

    await sleep(500)

    const storage = srv.handle.gameService.storageStatus()
    expect(storage.pendingSaves).toBe(0)
    expect(storage.pendingSaveOperations).toBe(0)
    expect(storage.saveFailures).toBe(0)

    for (const { gameId } of created) {
      const saved = await srv.db.getGame(gameId)
      expect(saved).not.toBeNull()
      expect((saved as unknown as { gameIsEnded: boolean }).gameIsEnded).toBe(
        true
      )
    }
  }, 300_000)
})

// ------------------------------------------------------------------ типы

interface GameStateSnapshotLike {
  id: string
  gameIsStarted: boolean
  gameIsEnded: boolean
  moveCounter: number | null
  tilePlacesStats: Record<number, Record<number, unknown>>
}

function countPlacedTiles(
  tilePlacesStats: GameStateSnapshotLike['tilePlacesStats']
): number {
  return Object.values(tilePlacesStats).reduce(
    (count, row) => count + Object.keys(row ?? {}).length,
    0
  )
}
