import { afterEach, describe, expect, it } from 'vitest'
import { TestClient } from './helpers/client'
import {
  createLobbyWithPlayers,
  latestGame,
  type TestGameData,
} from './helpers/lobby'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'

describe('Лобби', () => {
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

  it('создаёт лобби и подключает двух реальных и двух компьютерных игроков', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    const game = await latestGame(
      lobby.creator,
      (g) =>
        g.players[0]?.name === 'Alice' &&
        g.players[1]?.name === 'Bob' &&
        Boolean(g.players[2]?.name) &&
        Boolean(g.players[3]?.name)
    )

    expect(game.id).toBe(lobby.gameId)
    expect(game.gameIsStarted).toBeFalsy()

    const [alice, bob, aiP1, aiP2] = game.players

    expect(alice.name).toBe('Alice')
    expect(alice.socketId).toBeTruthy()
    expect(alice.deviceId).toBe('device-creator')

    expect(bob.name).toBe('Bob')
    expect(bob.socketId).toBeTruthy()
    expect(bob.deviceId).toBe('device-joiner')

    // Компьютерные игроки: есть имя, но нет ни socket, ни device
    expect(aiP1.name).toBeTruthy()
    expect(aiP1.socketId).toBeNull()
    expect(aiP1.deviceId).toBeNull()

    expect(aiP2.name).toBeTruthy()
    expect(aiP2.socketId).toBeNull()
    expect(aiP2.deviceId).toBeNull()
  })

  it('созданное лобби появляется в общем списке игр', async () => {
    server = await startTestServer()
    const creator = new TestClient(server.url, 'device-list-check')
    clients.push(creator)
    await creator.connect()
    creator.registerDevice()

    creator.emit('createGame')
    const created = (await creator.waitForEvent('gameCreated')) as {
      gameId: string
    }

    const { games } = await creator.emitAck<{
      games: Array<{ id: string; players: TestGameData['players'] }>
    }>('getGamesList')
    const found = games.find((g) => g.id === created.gameId)
    expect(found).toBeTruthy()
    expect(found!.players).toHaveLength(8)
  })

  it('ошибка при занятых слотах лобби', async () => {
    server = await startTestServer()
    const creator = new TestClient(server.url, 'device-full')
    clients.push(creator)
    await creator.connect()
    creator.registerDevice()

    creator.emit('createGame')
    const { gameId } = (await creator.waitForEvent('gameCreated')) as {
      gameId: string
    }

    // Заполняем все 8 слотов реальными игроками + пробуем зайти девятым
    const others: TestClient[] = []
    for (let i = 1; i <= 7; i++) {
      const client = new TestClient(server.url, `device-full-${i}`)
      clients.push(client)
      others.push(client)
      await client.connect()
      client.registerDevice()
      client.emit('joinGame', { gameId })
    }

    await Promise.all(others.map((c) => c.waitForEvent('gameUpdated')))

    const extra = new TestClient(server.url, 'device-full-extra')
    clients.push(extra)
    await extra.connect()
    extra.registerDevice()
    extra.emit('joinGame', { gameId })

    const error = (await extra.waitForEvent('error')) as unknown
    expect(error).toBe('Все слоты заняты')
  })

  it('удаляет игрока из лобби', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    await lobby.creator.emitAck('removePlayer', {
      gameId: lobby.gameId,
      index: 2,
      name: null,
    })

    const game = await latestGame(lobby.creator)
    expect(game.players[2].name).toBeFalsy()
    expect(game.players[2].socketId).toBeNull()
    expect(game.players[2].deviceId).toBeNull()
  })

  it('переименование реального игрока доходит до остальных', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    await lobby.joiner.emitAck('addPlayer', {
      gameId: lobby.gameId,
      name: 'Robert',
      index: 1,
    })

    const game = await latestGame(
      lobby.creator,
      (g: TestGameData) => g.players[1]?.name === 'Robert'
    )
    expect(game.players[1].name).toBe('Robert')
  })
})