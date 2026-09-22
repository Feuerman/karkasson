import { afterEach, describe, expect, it } from 'vitest'
import { TestClient } from './helpers/client'
import {
  countPlacedTiles,
  createLobbyWithSingleHuman,
  makeHumanMove,
  startGame,
  waitForHumanTurnOrEnd,
} from './helpers/gameplay'
import { createLobbyWithPlayers, latestGame } from './helpers/lobby'
import {
  createInMemoryStore,
  type InMemoryStore,
} from './helpers/inMemoryDatabase'
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

  it('начатая игра восстанавливается из базы и продолжается после перезапуска', async () => {
    const store = createInMemoryStore()
    server = await startTestServer(store)
    const lobby = await createLobbyWithSingleHuman(server.url)
    clients.push(lobby.creator)

    // Алиса делает один ход; компьютеры доигрывают цепочку до её очереди
    let state = await startGame(lobby.creator, lobby.gameId)
    const first = await makeHumanMove(lobby.creator, lobby.gameId, state)
    state = await waitForHumanTurnOrEnd(lobby.creator, lobby.aliceId, {
      initialState: first.game,
    })

    const beforeCount = countPlacedTiles(state.tilePlacesStats)
    const beforeMoveCounter = state.moveCounter
    const beforeScores = { ...state.scores }
    expect(beforeCount).toBeGreaterThanOrEqual(5)
    expect(beforeMoveCounter).toBeGreaterThan(0)

    // «Перезапуск»: останавливаем сервер и поднимаем с сохранённым слепком
    const snapshot = JSON.parse(JSON.stringify(store)) as InMemoryStore
    await stopTestServer(server)
    server = await startTestServer(snapshot)
    await server.handle.gameService.loadSavedGames()

    const restored = server.handle.gameService.getGame(lobby.gameId)
    expect(restored).toBeTruthy()
    expect(restored!.gameIsStarted).toBe(true)
    expect(restored!.gameIsEnded).toBe(false)
    expect(countPlacedTiles(restored!.tilePlacesStats)).toBe(beforeCount)
    expect(restored!.moveCounter).toBe(beforeMoveCounter)
    expect(restored!.scores).toEqual(beforeScores)

    // Алиса возвращается по deviceId и партия продолжается новым ходом
    const resumer = new TestClient(server.url, 'device-human')
    clients.push(resumer)
    await resumer.connect()
    resumer.registerDevice()
    resumer.emit('rejoinGame', {
      gameId: lobby.gameId,
      deviceId: 'device-human',
    })
    await latestGame(
      resumer,
      (game) => game.players[0]?.socketId === resumer.id
    )

    const resumed = await waitForHumanTurnOrEnd(resumer, lobby.aliceId)
    expect(countPlacedTiles(resumed.tilePlacesStats)).toBeGreaterThanOrEqual(
      beforeCount
    )

    const second = await makeHumanMove(resumer, lobby.gameId, resumed)
    expect(second.game.gameIsStarted).toBe(true)
    expect(second.game.gameIsEnded).toBe(false)
    expect(second.game.moveCounter).toBeGreaterThanOrEqual(beforeMoveCounter)
  })
})
