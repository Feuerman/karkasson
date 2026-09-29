import { afterEach, describe, expect, it } from 'vitest'
import { continueComputerGame } from '../../server/src/services/computerPlayer'
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

function countPlacedTiles(game: TestGameData): number {
  return Object.values(game.tilePlacesStats).reduce(
    (count, row) => count + Object.keys(row).length,
    0
  )
}

async function waitForCondition(
  condition: () => boolean,
  description: string,
  timeoutMs = 5_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Таймаут ожидания: ${description}`)
}

describe('Отключение и переподключение игроков', () => {
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

  it('временное отключение в игре сохраняет device игрока, реджойн возвращает его', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    // Начинаем игру
    lobby.creator.emit('startGame', { gameId: lobby.gameId })
    const started = await latestGame(
      lobby.creator,
      (g) => g.gameIsStarted === true
    )
    expect(started.gameIsStarted).toBe(true)
    expect(started.players[1].name).toBe('Bob')
    expect(started.players[1].socketId).toBeTruthy()
    expect(started.players[1].deviceId).toBe('device-joiner')

    // Оборвался транспорт у Боба — сервер должен увидеть «transport close»
    lobby.joiner.closeTransport()

    await latestGame(
      lobby.creator,
      (g) => g.players.find((p) => p.name === 'Bob')?.socketId === null
    )

    const tempEvent = (await lobby.creator.waitForEvent(
      'playerTemporaryDisconnected',
      (p) => (p as { deviceId?: string }).deviceId === 'device-joiner'
    )) as { deviceId: string }
    expect(tempEvent.deviceId).toBe('device-joiner')

    // Device у Боба сохранился, а socket освобождён
    const savedAfterDisconnect = await server.db.getGame(lobby.gameId)
    const savedBob = savedAfterDisconnect?.players.find((p) => p.name === 'Bob')
    expect(savedBob?.socketId).toBeNull()
    expect(savedBob?.deviceId).toBe('device-joiner')

    // Боб переподключается с тем же deviceId
    lobby.joiner.reconnect()
    await lobby.joiner.connect()
    lobby.joiner.registerDevice()
    lobby.joiner.emit('rejoinGame', {
      gameId: lobby.gameId,
      deviceId: lobby.joiner.deviceId,
    })

    const rejoined = await latestGame(
      lobby.joiner,
      (g) =>
        g.players.find((p) => p.name === 'Bob')?.socketId === lobby.joiner.id
    )
    const rejoinedBob = rejoined.players.find((p) => p.name === 'Bob')
    expect(rejoinedBob?.socketId).toBe(lobby.joiner.id)
    expect(rejoinedBob?.deviceId).toBe('device-joiner')
    expect(rejoined.gameIsStarted).toBe(true)
  })

  it('в лобби отключение игрока освобождает слот, повторный вход возвращает его', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    // Боб явно отключается из лобби → слот 1 освобождается (socket и device)
    lobby.joiner.disconnect()
    await latestGame(
      lobby.creator,
      (g) => g.players[1]?.socketId === null && g.players[1]?.deviceId === null
    )

    // Боб возвращается новым соединением; joinGame найдёт его бывший слот
    lobby.joiner.reconnect()
    await lobby.joiner.connect()
    lobby.joiner.registerDevice()
    lobby.joiner.emit('joinGame', { gameId: lobby.gameId })

    const rejoined = await latestGame(
      lobby.joiner,
      (g) =>
        g.players[1]?.deviceId === 'device-joiner' &&
        g.players[1]?.socketId === lobby.joiner.id
    )
    expect(rejoined.players[1].socketId).toBe(lobby.joiner.id)
    expect(rejoined.players[1].deviceId).toBe('device-joiner')
  })

  it('отключение последнего игрока лобби удаляет игру', async () => {
    server = await startTestServer()
    const creator = new TestClient(server.url, 'device-lone')
    clients.push(creator)
    await creator.connect()
    creator.registerDevice()

    creator.emit('createGame')
    const { gameId } = (await creator.waitForEvent('gameCreated')) as {
      gameId: string
    }

    creator.disconnect()

    await expect
      .poll(() => server!.handle.gameService.getGame(gameId), { timeout: 5000 })
      .toBeUndefined()
    await expect
      .poll(() => server!.db.getGame(gameId), { timeout: 5000 })
      .toBeNull()
  })

  it('переподключение после временного разрыва в начатой игре продолжает игру', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    lobby.creator.emit('startGame', { gameId: lobby.gameId })
    const before = await latestGame(
      lobby.creator,
      (g) => g.gameIsStarted === true
    )
    const beforeState: TestGameData = before

    lobby.creator.closeTransport()
    await latestGame(
      lobby.joiner,
      (g) => g.players.find((p) => p.name === 'Alice')?.socketId === null
    )

    lobby.creator.reconnect()
    await lobby.creator.connect()
    lobby.creator.registerDevice()
    lobby.creator.emit('rejoinGame', {
      gameId: lobby.gameId,
      deviceId: lobby.creator.deviceId,
    })

    const after = await latestGame(
      lobby.joiner,
      (g) =>
        g.players.find((p) => p.name === 'Alice')?.socketId === lobby.creator.id
    )
    expect(after.gameIsStarted).toBe(true)
    expect(after.tilePlacesStats).toEqual(beforeState.tilePlacesStats)
    expect(after.currentPlayer?.id).toBe(beforeState.currentPlayer?.id)
  })

  it('приостанавливает ИИ до переподключения всех людей и продолжает после их возвращения', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    await lobby.creator.emitAck('startGame', { gameId: lobby.gameId })
    const game = server.handle.gameService.getGame(lobby.gameId)
    if (!game) throw new Error('Игра не найдена')
    const computer = game.players[2]
    if (!computer) throw new Error('Компьютерный игрок не найден')
    game.currentPlayerIndex = 2
    game.currentPlayer = computer
    await server.handle.gameService.saveGame(lobby.gameId)

    lobby.joiner.closeTransport()
    const disconnected = await latestGame(
      lobby.creator,
      (state) =>
        state.players.find((player) => player.name === 'Bob')?.socketId === null
    )
    expect(
      disconnected.players.find((player) => player.name === 'Bob')?.deviceId
    ).toBe(lobby.joiner.deviceId)

    continueComputerGame(
      server.handle.io,
      server.handle.gameService,
      lobby.gameId
    )
    const tilesBeforePause = countPlacedTiles(
      server.handle.gameService.formatGameData(game) as TestGameData
    )
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(
      countPlacedTiles(
        server.handle.gameService.formatGameData(game) as TestGameData
      )
    ).toBe(tilesBeforePause)

    lobby.joiner.reconnect()
    await lobby.joiner.connect()
    lobby.joiner.registerDevice()
    await lobby.joiner.emitAck('rejoinGame', {
      gameId: lobby.gameId,
      deviceId: lobby.joiner.deviceId,
    })

    await waitForCondition(
      () =>
        countPlacedTiles(
          server?.handle.gameService.formatGameData(game) as TestGameData
        ) > tilesBeforePause,
      'возобновление ходов компьютера после возвращения игроков'
    )
  })

  it('удаляет смешанную партию, если человек не переподключился за отведённое время', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    await lobby.creator.emitAck('startGame', { gameId: lobby.gameId })
    const game = server.handle.gameService.getGame(lobby.gameId)
    if (!game) throw new Error('Игра не найдена')
    const computer = game.players[2]
    if (!computer) throw new Error('Компьютерный игрок не найден')
    game.currentPlayerIndex = 2
    game.currentPlayer = computer
    await server.handle.gameService.saveGame(lobby.gameId)

    lobby.joiner.closeTransport()
    await latestGame(
      lobby.creator,
      (state) =>
        state.players.find((player) => player.name === 'Bob')?.socketId === null
    )

    continueComputerGame(
      server.handle.io,
      server.handle.gameService,
      lobby.gameId,
      100
    )
    await waitForCondition(
      () => server?.handle.gameService.getGame(lobby.gameId) === undefined,
      'удаление партии после окончания срока переподключения'
    )
    expect(await server.db.getGame(lobby.gameId)).toBeNull()
  })
})
