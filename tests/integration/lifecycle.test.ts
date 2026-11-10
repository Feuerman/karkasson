import { describe, expect, it } from 'vitest'
import { SocketEvents } from '@server/modules/types'
import { TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import { createLobbyWithPlayers } from './helpers/lobby'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'

describe('Жизненный цикл партий', () => {
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

  async function stopCurrent(): Promise<void> {
    if (server) {
      await stopTestServer(server)
      server = undefined
    }
  }

  it('завершённая игра удаляется по истечении срока хранения (expired)', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    const game = server.handle.gameService.getGame(lobby.gameId)
    if (!game) throw new Error('Лобби не создано')
    game.gameIsStarted = true
    game.gameIsEnded = true
    game.currentPlayer = null
    game.currentTile = null
    game.lastUpdate = Date.now() - 25 * 60 * 60 * 1000 // давно завершённая

    const deleted = await server.handle.gameService.cleanupGames({
      abandonedTimeoutMs: 24 * 60 * 60 * 1000,
      finishedRetentionMs: 0, // любая завершённая игра устарела
    })

    expect(deleted).toHaveLength(1)
    expect(deleted[0]).toMatchObject({
      gameId: lobby.gameId,
      reason: 'expired',
    })
    expect(server.handle.gameService.getGame(lobby.gameId)).toBeUndefined()

    await stopCurrent()
  })

  it('активная игра с подключённым игроком не удаляется при очистке', async () => {
    server = await startTestServer()
    const creator = new TestClient(server.url, 'lifecycle-active-creator')
    clients.push(creator)
    await creator.connect()
    await creator.registerSession()

    creator.emit(SocketEvents.CreateGame)
    const { gameId } = await creator.waitForEvent<{ gameId: string }>(
      SocketEvents.GameCreated
    )

    const game = server.handle.gameService.getGame(gameId)
    if (!game) throw new Error('Лобби не создано')
    game.gameIsStarted = true
    game.gameIsEnded = false
    game.currentPlayer = null
    game.currentTile = null
    game.lastUpdate = 0 // старая, но игрок в сети

    const deleted = await server.handle.gameService.cleanupGames({
      abandonedTimeoutMs: 0, // любой возраст считается заброшенным
      finishedRetentionMs: 24 * 60 * 60 * 1000,
    })

    expect(deleted).toHaveLength(0)
    expect(server.handle.gameService.getGame(gameId)).toBeTruthy()

    await stopCurrent()
  })

  it('заброшенная started-игра без подключённых игроков удаляется (stale)', async () => {
    server = await startTestServer()
    const creator = new TestClient(server.url, 'lifecycle-stale-creator')
    clients.push(creator)
    await creator.connect()
    await creator.registerSession()

    creator.emit(SocketEvents.CreateGame)
    const { gameId } = await creator.waitForEvent<{ gameId: string }>(
      SocketEvents.GameCreated
    )

    const game = server.handle.gameService.getGame(gameId)
    if (!game) throw new Error('Лобби не создано')
    // Симулируем отключение всех людей: сбрасываем socketId, не вызывая
    // обработчик disconnect сервера (он бы удалил лобби раньше очистки).
    game.players.forEach((p) => {
      p.socketId = null
    })
    game.gameIsStarted = true
    game.gameIsEnded = false
    game.lastUpdate = Date.now() - 25 * 60 * 60 * 1000 // давно без активности

    const deleted = await server.handle.gameService.cleanupGames({
      abandonedTimeoutMs: 0,
      finishedRetentionMs: 24 * 60 * 60 * 1000,
    })

    expect(deleted).toHaveLength(1)
    expect(deleted[0]).toMatchObject({ gameId, reason: 'stale' })
    expect(server.handle.gameService.getGame(gameId)).toBeUndefined()

    await stopCurrent()
  })

  it('TTL завершённых игр не трогает активные и ожидающие партии', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    const game = server.handle.gameService.getGame(lobby.gameId)
    if (!game) throw new Error('Лобби не создано')
    game.lastUpdate = 0

    const deleted = await server.handle.gameService.cleanupGames({
      abandonedTimeoutMs: 24 * 60 * 60 * 1000,
      finishedRetentionMs: 0,
    })

    // Незавершённая игра не удаляется по finishedRetentionMs.
    expect(deleted).toHaveLength(0)
    expect(server.handle.gameService.getGame(lobby.gameId)).toBeTruthy()

    await stopCurrent()
  })
})
