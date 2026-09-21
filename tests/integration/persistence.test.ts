import { afterEach, describe, expect, it } from 'vitest'
import { TestClient } from './helpers/client'
import { createLobbyWithPlayers, latestGame } from './helpers/lobby'
import { createInMemoryStore, type InMemoryStore } from './helpers/inMemoryDatabase'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'

describe('Сохранение данных лобби', () => {
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

  it('сохранённое лобби восстанавливается после перезапуска сервера', async () => {
    const store = createInMemoryStore()
    server = await startTestServer(store)
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    const game = await latestGame(lobby.creator)
    expect(game.gameIsStarted).toBeFalsy()

    // Сервер сохраняет лобби через тот же путь, что и в игровом процессе
    await server.handle.gameService.saveGame(lobby.gameId)

    // Состояние легло в хранилище со всеми игроками
    const saved = await server.db.getGame(lobby.gameId)
    expect(saved?.id).toBe(lobby.gameId)
    expect(saved?.players[0]).toMatchObject({
      name: 'Alice',
      deviceId: 'device-creator',
    })
    expect(saved?.players[1]).toMatchObject({
      name: 'Bob',
      deviceId: 'device-joiner',
    })
    expect(saved?.players[1].socketId).toBeTruthy()
    expect(saved?.players[2]).toMatchObject({
      name: expect.any(String),
      socketId: null,
      deviceId: null,
    })
    expect(saved?.players[3].socketId).toBeNull()

    // Перезапуск: отключение старых сокетов при закрытии сервера могло бы
    // удалить лобби из общего хранилища (disconnect-handler), поэтому
    // «сохранённое состояние» снимаем слепком до остановки.
    const snapshot = JSON.parse(JSON.stringify(store)) as InMemoryStore
    await stopTestServer(server)
    server = await startTestServer(snapshot)
    await server.handle.gameService.loadSavedGames()

    const restored = server.handle.gameService.getGame(lobby.gameId)
    expect(restored).toBeTruthy()
    expect(restored!.players[0].name).toBe('Alice')
    expect(restored!.players[1].name).toBe('Bob')
    expect(restored!.players[1].deviceId).toBe('device-joiner')
    expect(restored!.players[2].name).toBeTruthy()
    expect(restored!.players[2].socketId).toBeNull()
    expect(restored!.players[2].deviceId).toBeNull()
  })
})