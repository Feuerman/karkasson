import { afterEach, describe, expect, it } from 'vitest'
import { GameService } from '../../src/modules/GameService'
import { findValidPlacement, type GameStateSnapshot } from './helpers/gameplay'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'

/**
 * Тесты клиентского приложения: настоящий клиентский GameService
 * (socket.io-client, промисы, обработка ошибок) работает против
 * настоящего тестового сервера.
 */

type AnyGame = Record<string, unknown> & {
  gameIsStarted?: boolean
  gameIsEnded?: boolean
  currentPlayer?: { id: number | string; name: string | null } | null
  isPlacingFollower?: boolean
  currentTile?: { sides: Record<string, string> } | null
  availablePlacesTiles?: Array<{ rowIndex: number; tileIndex: number }>
  tilePlacesStats?: Record<number, Record<number, unknown>>
  players: Array<{ id: number | string; name: string | null }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitUntilConnected(service: GameService): Promise<void> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (service.socket?.connected) return
    await sleep(50)
  }
  throw new Error('Клиентский socket не подключился')
}

async function waitForServerDevice(
  server: RunningServer,
  service: GameService
): Promise<void> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const socketId = service.socket?.id
    if (
      socketId &&
      server.handle.gameService.getDeviceBySocketId(socketId) ===
        service.deviceId
    ) {
      return
    }
    await sleep(50)
  }
  throw new Error(`device ${service.deviceId} не зарегистрировался на сервере`)
}

function waitGameUpdated(
  service: GameService,
  predicate: (game: AnyGame) => boolean,
  timeoutMs = 20_000
): Promise<AnyGame> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      service.socket?.off('gameUpdated', handler)
      reject(new Error('Таймаут ожидания gameUpdated'))
    }, timeoutMs)
    const handler = (game: AnyGame) => {
      if (predicate(game)) {
        clearTimeout(timer)
        service.socket?.off('gameUpdated', handler)
        resolve(game)
      }
    }
    service.socket?.on('gameUpdated', handler)
  })
}

describe('Клиентское приложение (GameService)', () => {
  let server: RunningServer | undefined
  const services: GameService[] = []

  afterEach(async () => {
    for (const service of services) service.disconnect()
    services.length = 0
    if (server) {
      await stopTestServer(server)
      server = undefined
    }
  })

  it('создаёт лобби, добавляет игроков и видит игру в списке', async () => {
    server = await startTestServer()
    const alice = new GameService({
      serverUrl: server.url,
      deviceId: 'client-alice',
    })
    services.push(alice)
    expect(localStorage.getItem('deviceId')).toBe('client-alice')

    alice.connect()
    await waitUntilConnected(alice)
    await waitForServerDevice(server, alice)

    const created = await alice.createGame()
    expect(alice.gameId).toBeTruthy()
    expect(created.id).toBe(alice.gameId)

    await alice.addPlayer({ name: 'Alice', index: 0 })

    const games = (await alice.getGamesList()) as Array<{
      id: string
      players: Array<{ name: string | null }>
    }>
    const found = games.find((g) => g.id === alice.gameId)
    expect(found).toBeTruthy()
    expect(found!.players[0].name).toBe('Alice')
  })

  it('играет ход через клиентский сервис и получает отказ вне очереди', async () => {
    server = await startTestServer()
    const alice = new GameService({
      serverUrl: server.url,
      deviceId: 'client-alice',
    })
    const bob = new GameService({
      serverUrl: server.url,
      deviceId: 'client-bob',
    })
    services.push(alice, bob)

    alice.connect()
    bob.connect()
    await waitUntilConnected(alice)
    await waitUntilConnected(bob)
    await waitForServerDevice(server, alice)
    await waitForServerDevice(server, bob)

    // Лобби: Алиса создаёт, Боб присоединяется, добавляем компьютерных
    await alice.createGame()
    await alice.addPlayer({ name: 'Alice', index: 0 })
    await bob.joinGame(alice.gameId, 'Bob')
    await bob.addPlayer({ name: 'Bob', index: 1 })
    await alice.addPlayer({ name: null, index: 2 })
    await alice.addPlayer({ name: null, index: 3 })

    // Старт игры
    alice.startGame()
    const started = await waitGameUpdated(
      alice,
      (game) =>
        game.gameIsStarted === true && game.currentPlayer?.name === 'Alice'
    )
    expect(started.currentPlayer?.id).toBe(started.players[0].id)

    // Ход Алисы через клиентские методы
    const move = findValidPlacement(started as unknown as GameStateSnapshot)
    expect(move).not.toBeNull()

    const updated = await alice.updateCurrentTile(move!.tile)
    expect(updated).toMatchObject({ success: true })

    const placed = await alice.placeTile(move!.tile, {
      rowIndex: move!.rowIndex,
      tileIndex: move!.tileIndex,
    })
    expect(placed).toMatchObject({ success: true })

    if ((placed as AnyGame).game?.isPlacingFollower) {
      const skipped = await alice.skipFollower()
      expect(skipped).toMatchObject({ success: true })
    }

    // Очередь перешла к Бобу (видно и у Алисы, и у Боба)
    const bobTurn = await waitGameUpdated(
      bob,
      (game) =>
        game.currentPlayer?.name === 'Bob' && game.isPlacingFollower !== true
    )
    expect(bobTurn.currentPlayer?.id).toBe(bobTurn.players[1].id)

    // Алиса пробует ходить на ходу Боба — сервис отклоняет промис
    await expect(
      alice.placeTile(move!.tile, {
        rowIndex: move!.rowIndex,
        tileIndex: move!.tileIndex,
      })
    ).rejects.toThrow("Not player's turn")
  })
})
