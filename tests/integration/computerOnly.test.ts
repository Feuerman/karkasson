import { afterEach, describe, expect, it } from 'vitest'
import { TestClient } from './helpers/client'
import {
  assertFollowerInvariants,
  countPlacedTiles,
  type GameStateSnapshot,
  verifyScoringAgainstServer,
} from './helpers/gameplay'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'

describe('Полностью автоматическая партия (4 компьютера)', () => {
  let server: RunningServer | undefined
  const clients: TestClient[] = []

  afterEach(async () => {
    for (const client of clients) client.dispose()
    clients.length = 0
    if (server) {
      await stopTestServer(server)
      server = undefined
    }
  })

  it('игра с четырьмя компьютерами доигрывается до конца автоматически', async () => {
    server = await startTestServer()
    const creator = new TestClient(server.url, 'device-spectator')
    clients.push(creator)
    await creator.connect()
    creator.registerDevice()

    // Лобби из четырёх компьютерных игроков (без реальных человека - все слоты ИИ).
    // Создатель по умолчанию занимает слот 0, поэтому освобождаем его —
    // иначе `startGame` не увидит «всех компьютеров» и не запустит автоигру.
    creator.emit('createGame')
    const { gameId } = (await creator.waitForEvent('gameCreated')) as {
      gameId: string
    }
    await creator.emitAck('removePlayer', { gameId, index: 0, name: null })
    for (let index = 0; index < 4; index++) {
      await creator.emitAck('addPlayer', { gameId, name: null, index })
    }

    // Старт автоматически запускает цепочку компьютерных ходов
    creator.emit('startGame', { gameId })

    const started = await creator.waitForEvent(
      'gameUpdated',
      (payload) =>
        (payload as GameStateSnapshot).gameIsStarted === true &&
        (payload as GameStateSnapshot).gameIsEnded === false
    )
    const startedState = started as GameStateSnapshot
    expect(startedState.gameIsStarted).toBe(true)
    expect(startedState.tilePlacesStats[15]?.[15]).toBeTruthy()

    // Ждём завершения партии (71 ход колоды + стартовый тайл)
    const endedPayload = await creator.waitForEvent(
      'gameUpdated',
      (payload) => (payload as GameStateSnapshot).gameIsEnded === true,
      120_000
    )
    const ended = endedPayload as GameStateSnapshot
    expect(ended.gameIsEnded).toBe(true)
    expect(countPlacedTiles(ended.tilePlacesStats)).toBe(72)

    // Очки согласуются с завершёнными строениями, фишки не потеряны
    verifyScoringAgainstServer(ended)
    assertFollowerInvariants(ended)

    // Общий список игр обновлён: игра помечена как завершённая
    const { games } = await creator.emitAck<{
      games: Array<{ id: string; gameIsEnded: boolean }>
    }>('getGamesList')
    const summary = games.find((g) => g.id === gameId)
    expect(summary?.gameIsEnded).toBe(true)

    // Финальное состояние сохранено в базе
    const saved = await server.db.getGame(gameId)
    expect(saved).not.toBeNull()
    expect(saved!.gameIsEnded).toBe(true)
    expect(saved!.moveCounter).toBe(ended.moveCounter)
  }, 180_000)
})
