import { describe, expect, it } from 'vitest'
import { CommonErrors } from '@server/modules/errors'
import { SocketEvents } from '@server/modules/types'
import { TestClient, connectTestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import {
  createLobby,
  createLobbyWithPlayers,
  latestGame,
  type TestGameData,
} from './helpers/lobby'
import { startTestServer, type RunningServer } from './helpers/server'
import { sleep, waitForCondition } from './helpers/wait'
import { countPlacedTiles } from './helpers/gameplay'

describe('Отключение и переподключение игроков', () => {
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

  it('временное отключение в игре сохраняет сессию игрока, реджойн возвращает его', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    // Начинаем игру
    lobby.creator.emit(SocketEvents.StartGame, { gameId: lobby.gameId })
    const started = await latestGame(
      lobby.creator,
      (g) => g.gameIsStarted === true
    )
    expect(started.gameIsStarted).toBe(true)
    expect(started.players[1].name).toBe('Bob')
    expect(started.players[1].isConnected).toBe(true)
    expect(started.players[1].sessionId).toBe(lobby.joiner.sessionId)

    // Оборвался транспорт у Боба — сервер должен увидеть «transport close»
    lobby.joiner.closeTransport()

    await latestGame(
      lobby.creator,
      (g) => g.players.find((p) => p.name === 'Bob')?.isConnected === false
    )

    const bobId = started.players[1].id
    const tempEvent = await lobby.creator.waitForEvent<{
      playerIds: Array<number | string>
    }>(SocketEvents.PlayerTemporaryDisconnected, (payload) =>
      payload.playerIds.includes(bobId)
    )
    expect(tempEvent.playerIds).toContain(bobId)

    // Сессия Боба сохранилась, а socket освобождён
    const savedAfterDisconnect = await server.db.getGame(lobby.gameId)
    const savedBob = savedAfterDisconnect?.players.find((p) => p.name === 'Bob')
    expect(savedBob?.socketId).toBeNull()
    expect(savedBob?.sessionId).toBe(lobby.joiner.sessionId)

    // Боб переподключается с тем же токеном сессии
    lobby.joiner.reconnect()
    await lobby.joiner.connect()
    await lobby.joiner.registerSession()
    lobby.joiner.emit(SocketEvents.RejoinGame, { gameId: lobby.gameId })

    const rejoined = await latestGame(
      lobby.joiner,
      (g) =>
        g.gameIsStarted === true &&
        g.players.find((p) => p.name === 'Bob')?.isConnected === true
    )
    const rejoinedBob = rejoined.players.find((p) => p.name === 'Bob')
    expect(rejoinedBob?.isConnected).toBe(true)
    expect(rejoinedBob?.sessionId).toBe(lobby.joiner.sessionId)
    expect(rejoined.gameIsStarted).toBe(true)
  })

  it('не восстанавливает чужой слот по публичному sessionId', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    await lobby.creator.emitAck(SocketEvents.StartGame, {
      gameId: lobby.gameId,
    })
    lobby.joiner.closeTransport()
    const disconnected = await latestGame(
      lobby.creator,
      (g) => g.players.find((p) => p.name === 'Bob')?.isConnected === false
    )
    const bob = disconnected.players.find((p) => p.name === 'Bob')
    if (!bob?.sessionId) throw new Error('Сессия Боба не найдена')

    const mallory = await connectTestClient(server.url, 'device-mallory')
    clients.push(mallory)
    expect(mallory.sessionId).not.toBe(bob.sessionId)

    await expect(
      mallory.emitAck(SocketEvents.RejoinGame, { gameId: lobby.gameId })
    ).rejects.toThrow(CommonErrors.PlayerNotFoundInGame)

    const bobSlot = server.handle.gameService
      .getGame(lobby.gameId)
      ?.players.find((p) => p.name === 'Bob')
    expect(bobSlot?.socketId).toBeNull()
    expect(bobSlot?.sessionId).toBe(bob.sessionId)
  })

  it('сохраняет состояние до рассылки обновления при отключении', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    await lobby.creator.emitAck(SocketEvents.StartGame, {
      gameId: lobby.gameId,
    })

    let resolveSaveStarted: (() => void) | undefined
    const saveStarted = new Promise<void>((resolve) => {
      resolveSaveStarted = resolve
    })
    let releaseSave: (() => void) | undefined
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve
    })
    const originalSave = server.db.saveGame.bind(server.db)
    server.db.saveGame = async (gameId, serializedState) => {
      resolveSaveStarted?.()
      await saveGate
      await originalSave(gameId, serializedState)
    }

    let updateReceived = false
    lobby.creator.socket.on(SocketEvents.GameUpdated, () => {
      updateReceived = true
    })

    lobby.joiner.closeTransport()
    await saveStarted
    await sleep(50)
    expect(updateReceived).toBe(false)

    releaseSave?.()
    await latestGame(
      lobby.creator,
      (game) =>
        game.players.find((player) => player.name === 'Bob')?.isConnected ===
        false
    )
    expect(updateReceived).toBe(true)

    const saved = await server.db.getGame(lobby.gameId)
    expect(
      saved?.players.find((player) => player.name === 'Bob')?.socketId
    ).toBeNull()
  })

  it('в лобби отключение игрока освобождает слот, повторный вход возвращает его', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    // Боб явно отключается из лобби → слот 1 освобождается (socket и сессия)
    lobby.joiner.disconnect()
    await latestGame(
      lobby.creator,
      (g) => g.players[1]?.isConnected === false && !g.players[1]?.sessionId
    )

    // Боб возвращается новым соединением; joinGame найдёт его бывший слот
    lobby.joiner.reconnect()
    await lobby.joiner.connect()
    await lobby.joiner.registerSession()
    lobby.joiner.emit(SocketEvents.JoinGame, { gameId: lobby.gameId })

    const rejoined = await latestGame(
      lobby.joiner,
      (g) =>
        g.players[1]?.sessionId === lobby.joiner.sessionId &&
        g.players[1]?.isConnected === true
    )
    expect(rejoined.players[1].isConnected).toBe(true)
    expect(rejoined.players[1].sessionId).toBe(lobby.joiner.sessionId)
  })

  it('отключение последнего игрока лобби удаляет игру', async () => {
    server = await startTestServer()
    const { gameId, creator } = await createLobby(server.url, {
      identity: 'device-lone',
      computers: 0,
    })
    clients.push(creator)

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

    lobby.creator.emit(SocketEvents.StartGame, { gameId: lobby.gameId })
    const before = await latestGame(
      lobby.creator,
      (g) => g.gameIsStarted === true
    )
    const beforeState: TestGameData = before

    lobby.creator.closeTransport()
    await latestGame(
      lobby.joiner,
      (g) => g.players.find((p) => p.name === 'Alice')?.isConnected === false
    )

    lobby.creator.reconnect()
    await lobby.creator.connect()
    await lobby.creator.registerSession()
    lobby.creator.emit(SocketEvents.RejoinGame, { gameId: lobby.gameId })

    const after = await latestGame(
      lobby.joiner,
      (g) =>
        g.gameIsStarted === true &&
        g.players.find((p) => p.name === 'Alice')?.isConnected === true
    )
    expect(after.gameIsStarted).toBe(true)
    expect(after.tilePlacesStats).toEqual(beforeState.tilePlacesStats)
    expect(after.currentPlayer?.id).toBe(beforeState.currentPlayer?.id)
  })

  it('приостанавливает ИИ до переподключения всех людей и продолжает после их возвращения', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    await lobby.creator.emitAck(SocketEvents.StartGame, {
      gameId: lobby.gameId,
    })
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
        state.players.find((player) => player.name === 'Bob')?.isConnected ===
        false
    )
    expect(
      disconnected.players.find((player) => player.name === 'Bob')?.sessionId
    ).toBe(lobby.joiner.sessionId)

    server.handle.gameService.computerMoves.continueGame(
      server.handle.events,
      server.handle.gameService,
      lobby.gameId
    )
    const placedTiles = () =>
      countPlacedTiles(
        server!.handle.gameService.getGame(lobby.gameId)!.tilePlacesStats
      )
    const tilesBeforePause = placedTiles()
    await sleep(250)
    expect(placedTiles()).toBe(tilesBeforePause)

    lobby.joiner.reconnect()
    await lobby.joiner.connect()
    await lobby.joiner.registerSession()
    await lobby.joiner.emitAck(SocketEvents.RejoinGame, {
      gameId: lobby.gameId,
    })

    await waitForCondition(
      () => placedTiles() > tilesBeforePause,
      'возобновление ходов компьютера после возвращения игроков'
    )
  })

  it('удаляет смешанную партию, если человек не переподключился за отведённое время', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    await lobby.creator.emitAck(SocketEvents.StartGame, {
      gameId: lobby.gameId,
    })
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
        state.players.find((player) => player.name === 'Bob')?.isConnected ===
        false
    )

    server.handle.gameService.computerMoves.continueGame(
      server.handle.events,
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

  it('освобождает слот игрока во всех партиях, где он состоял', async () => {
    server = await startTestServer()
    const own = await createLobby(server.url, {
      identity: 'device-alice',
      computers: 0,
    })
    const foreign = await createLobby(server.url, {
      identity: 'device-bob',
      computers: 0,
    })
    const alice = own.creator
    clients.push(alice, foreign.creator)

    // Алиса состоит сразу в двух лобби: в своём (слот 0) и в чужом (слот 1).
    await alice.emitAck(SocketEvents.JoinGame, { gameId: foreign.gameId })

    alice.closeTransport()

    const slot = (gameId: string, index: number) =>
      server?.handle.gameService.getGame(gameId)?.players[index]

    await waitForCondition(() => {
      const ownSlot = slot(own.gameId, 0)
      const foreignSlot = slot(foreign.gameId, 1)
      // Обрабатывается только первая партия, если сокет ищут по одной игре.
      return (
        ownSlot?.socketId === null &&
        ownSlot.sessionId === null &&
        foreignSlot?.socketId === null &&
        foreignSlot.sessionId === null
      )
    }, 'освобождение слота во всех партиях отключившегося игрока')
  })
})
