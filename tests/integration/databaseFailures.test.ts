import { describe, expect, it } from 'vitest'
import { CommonErrors, LobbyErrors } from '@server/modules/errors'
import { SocketEvents } from '@server/modules/types'
import { TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import { createLobbyWithPlayers } from './helpers/lobby'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'
import {
  createInMemoryStore,
  type InMemoryStore,
} from './helpers/inMemoryDatabase'

describe('Отказы хранилища и восстановление', () => {
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

  it('ошибка записи при выходе из лобби откатывает освобождение слота', async () => {
    const store = createInMemoryStore()
    server = await startTestServer(store)

    const creator = new TestClient(server.url, 'db-save-leave-creator')
    clients.push(creator)
    await creator.connect()
    await creator.registerSession()

    creator.emit(SocketEvents.CreateGame)
    const { gameId } = await creator.waitForEvent<{ gameId: string }>(
      SocketEvents.GameCreated
    )

    const joiner = new TestClient(server.url, 'db-save-leave-joiner')
    clients.push(joiner)
    await joiner.connect()
    await joiner.registerSession()
    await joiner.emitAck(SocketEvents.JoinGame, { gameId })

    // Ошибка записи только на выходе: слот не освобождается, ошибка SaveFailed.
    server.db.saveError = new Error('firebase write failed')
    await expect(
      joiner.emitAck(SocketEvents.LeaveGame, { gameId })
    ).rejects.toThrow(CommonErrors.SaveFailed)

    const game = server.handle.gameService.getGame(gameId)
    expect(game).toBeTruthy()
    // Игра не удалена, владелец восстановлен откатом, слот freed в памяти.
    expect(game!.ownerSessionId).toBe(creator.sessionId)
    expect(
      game!.players.find((p) => p.sessionId === creator.sessionId)
    ).toBeTruthy()

    server.db.saveError = null
    await stopCurrent()
  })

  it('ошибка записи при выходе из начатой партии откатывает изменение', async () => {
    const store = createInMemoryStore()
    server = await startTestServer(store)

    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    const game = server.handle.gameService.getGame(lobby.gameId)
    if (!game) throw new Error('Лобби не создано')
    game.gameIsStarted = true
    game.gameIsEnded = false
    game.currentPlayer = null
    game.currentTile = null
    await server.handle.gameService.saveGame(lobby.gameId)

    server.db.saveError = new Error('firebase write failed')
    await expect(
      lobby.joiner.emitAck(SocketEvents.LeaveGame, { gameId: lobby.gameId })
    ).rejects.toThrow(CommonErrors.SaveFailed)

    const after = server.handle.gameService.getGame(lobby.gameId)
    expect(
      after!.players.find((p) => p.sessionId === lobby.joiner.sessionId)
    ).toBeTruthy()

    server.db.saveError = null
    await stopCurrent()
  })

  it('ошибка чтения при загрузке сохранений после рестарта пробрасывается', async () => {
    const store = createInMemoryStore()
    server = await startTestServer(store)
    server.db.readError = new Error('firebase read failed')

    await expect(server.handle.gameService.loadSavedGames()).rejects.toThrow(
      'firebase read failed'
    )

    server.db.readError = null
    await stopCurrent()
  })

  it('ошибка удаления не убирает партию из памяти при сбое БД', async () => {
    const store = createInMemoryStore()
    server = await startTestServer(store)
    server.db.deleteError = new Error('firebase delete failed')

    const creator = new TestClient(server.url, 'db-delete-creator')
    clients.push(creator)
    await creator.connect()
    await creator.registerSession()

    creator.emit(SocketEvents.CreateGame)
    const { gameId } = await creator.waitForEvent<{ gameId: string }>(
      SocketEvents.GameCreated
    )

    await expect(server.handle.gameService.deleteGame(gameId)).rejects.toThrow(
      'firebase delete failed'
    )
    expect(server.handle.gameService.getGame(gameId)).toBeTruthy()

    server.db.deleteError = null
    await stopCurrent()
  })

  it('партия восстанавливается после рестарта сервера с рабочим хранилищем', async () => {
    const store = createInMemoryStore()
    server = await startTestServer(store)
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    await server.handle.gameService.saveGame(lobby.gameId)

    const snapshot = JSON.parse(JSON.stringify(store)) as InMemoryStore
    await stopTestServer(server)
    server = undefined

    server = await startTestServer(snapshot)
    await server.handle.gameService.loadSavedGames()

    const restored = server.handle.gameService.getGame(lobby.gameId)
    expect(restored).toBeTruthy()
    expect(restored!.roomCode).toMatch(/^\d{6}$/)
    expect(restored!.players[0]?.name).toBe('Alice')
    expect(restored!.players[1]?.name).toBe('Bob')

    await stopTestServer(server)
    server = undefined
  })

  it('минимум игроков для старта: один человек не запускает игру', async () => {
    server = await startTestServer()
    const creator = new TestClient(server.url, 'db-min-players')
    clients.push(creator)
    await creator.connect()
    await creator.registerSession()

    creator.emit(SocketEvents.CreateGame)
    const { gameId } = await creator.waitForEvent<{ gameId: string }>(
      SocketEvents.GameCreated
    )

    await expect(
      creator.emitAck(SocketEvents.StartGame, { gameId })
    ).rejects.toThrow(LobbyErrors.NotEnoughPlayers)

    await stopCurrent()
  })
})
