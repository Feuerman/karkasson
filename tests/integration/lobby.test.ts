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

  it('leaveGame удаляет пустое лобби и обновляет список игр', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    // joiner уходит первым — creator ещё в лобби, игра остаётся.
    // Берём слепок из того же предикатного latestGame (повторный вызов
    // создавал бы гонку между двумя разными socket-соединениями).
    lobby.joiner.emit('leaveGame', { gameId: lobby.gameId })
    const afterJoiner = (
      await latestGame(
        lobby.creator,
        (g) =>
          g.players[1] !== undefined &&
          !g.players[1].socketId &&
          !g.players[1].deviceId &&
          Boolean(g.players[0]?.socketId)
      )
    ).players as Array<{
      socketId: string | null
      deviceId: string | null
    }>
    expect(afterJoiner[0].socketId).toBeTruthy()
    expect(afterJoiner[1].socketId).toBeNull()

    // creator (последний активный игрок) уходит тоже — лобби пустеет,
    // сервер удаляет игру, шлёт gameDeleted и обновляет updateGamesList.
    lobby.creator.emit('leaveGame', { gameId: lobby.gameId })
    await lobby.creator.waitForEvent('gameDeleted')

    const { games } = await lobby.creator.emitAck<{
      games: Array<{ id: string }>
    }>('getGamesList')
    expect(games.find((g) => g.id === lobby.gameId)).toBeFalsy()
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

  it('завершённую игру можно загрузить для просмотра без занятия слота', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    const game = server.handle.gameService.getGame(lobby.gameId)
    expect(game).toBeTruthy()
    if (!game) throw new Error('Лобби не создано')
    game.gameIsStarted = true
    game.gameIsEnded = true
    game.currentPlayer = null
    game.currentTile = null
    await server.handle.gameService.saveGame(lobby.gameId)

    const observer = new TestClient(server.url, 'device-observer')
    clients.push(observer)
    await observer.connect()
    observer.registerDevice()

    const response = await observer.emitAck<{
      success: boolean
      game: TestGameData
    }>('joinGame', { gameId: lobby.gameId })

    expect(response.success).toBe(true)
    expect(response.game.gameIsEnded).toBe(true)
    expect(
      game.players.every((player) => player.socketId !== observer.id)
    ).toBe(true)
  })

  it('завершённые партии идут раньше остальных, от новых к старым', async () => {
    server = await startTestServer()
    const first = await createLobbyWithPlayers(server.url)
    const second = await createLobbyWithPlayers(server.url)
    clients.push(first.creator, first.joiner, second.creator, second.joiner)

    const olderEnded = server.handle.gameService.getGame(first.gameId)
    const newerEnded = server.handle.gameService.getGame(second.gameId)
    if (!olderEnded || !newerEnded) throw new Error('Лобби не созданы')
    olderEnded.gameIsEnded = true
    olderEnded.lastUpdate = 10
    newerEnded.gameIsEnded = true
    newerEnded.lastUpdate = 20

    const active = server.handle.gameService.createLobby('socket-active')
    active.lastUpdate = 30

    const ids = server.handle.gameService
      .formatGamesList()
      .map((gameSummary) => gameSummary.id)

    expect(ids.slice(0, 2)).toEqual([second.gameId, first.gameId])
    expect(ids[2]).toBe(active.id)
  })
})
