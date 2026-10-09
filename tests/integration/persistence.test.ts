import { afterEach, describe, expect, it } from 'vitest'
import { GameManager } from '@server/modules/GameManager'
import { resumeComputerGames } from '@server/services/computerPlayer'
import { SocketEvents, type Player } from '@server/modules/types'
import { TestClient } from './helpers/client'
import {
  countPlacedTiles,
  createLobbyWithSingleHuman,
  makeHumanMove,
  startGame,
  waitForHumanTurnOrEnd,
  type GameStateSnapshot,
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

async function restartWithComputerGame(): Promise<RunningServer> {
  const initialServer = await startTestServer()
  const game = new GameManager({
    players: [
      {
        id: 1,
        name: 'AI',
        color: 'coral',
        score: 0,
        socketId: null,
        deviceId: null,
      },
    ],
  })
  game.id = 'computer-game'
  const [currentTile] = game.tilesList
  if (!currentTile) throw new Error('Компьютерная партия не получила тайл')
  game.currentTile = { ...currentTile, x: 0, y: 0 }
  game.tilesList = []

  initialServer.handle.gameService.restoreGame(game.id, game)
  await initialServer.handle.gameService.saveGame(game.id)
  const snapshot = JSON.parse(
    JSON.stringify(initialServer.store)
  ) as InMemoryStore
  await stopTestServer(initialServer)

  const restartedServer = await startTestServer(snapshot)
  await restartedServer.handle.gameService.loadSavedGames()
  return restartedServer
}

async function waitForCondition(
  condition: () => boolean,
  description: string
): Promise<void> {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Таймаут ожидания: ${description}`)
}

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
    expect(saved?.roomCode).toMatch(/^\d{6}$/)
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
    expect(restored?.roomCode).toBe(saved?.roomCode)
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
    resumer.emit(SocketEvents.RejoinGame, {
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

  it('после перезапуска смешанной партии ИИ ждёт подключения всех людей', async () => {
    const store = createInMemoryStore()
    server = await startTestServer(store)
    const players: Player[] = [
      {
        id: 1,
        name: 'Alice',
        color: 'coral',
        score: 0,
        socketId: 'old-socket-alice',
        deviceId: 'device-alice',
      },
      {
        id: 2,
        name: 'Bob',
        color: 'skyblue',
        score: 0,
        socketId: 'old-socket-bob',
        deviceId: 'device-bob',
      },
      {
        id: 3,
        name: 'Computer',
        color: 'lime',
        score: 0,
        socketId: null,
        deviceId: null,
      },
    ]
    const game = new GameManager({ players })
    game.id = 'mixed-game'
    game.currentPlayerIndex = 2
    game.currentPlayer = game.players[2] ?? null
    server.handle.gameService.restoreGame(game.id, game)
    await server.handle.gameService.saveGame(game.id)

    const beforeRestart = countPlacedTiles(
      server.handle.gameService.formatGameData(game)
        .tilePlacesStats as GameStateSnapshot['tilePlacesStats']
    )
    const snapshot = JSON.parse(JSON.stringify(store)) as InMemoryStore
    await stopTestServer(server)
    server = await startTestServer(snapshot)
    await server.handle.gameService.loadSavedGames()
    resumeComputerGames(server.handle.io, server.handle.gameService, 5_000)

    const restored = server.handle.gameService.getGame('mixed-game')
    if (!restored) throw new Error('Смешанная партия не восстановлена')
    expect(restored.players[0]?.socketId).toBeNull()
    expect(restored.players[1]?.socketId).toBeNull()

    expect(
      countPlacedTiles(
        server.handle.gameService.formatGameData(restored)
          .tilePlacesStats as GameStateSnapshot['tilePlacesStats']
      )
    ).toBe(beforeRestart)

    const alice = new TestClient(server.url, 'device-alice')
    const bob = new TestClient(server.url, 'device-bob')
    clients.push(alice, bob)
    await Promise.all([alice.connect(), bob.connect()])
    alice.registerDevice()
    bob.registerDevice()
    await Promise.all([
      alice.emitAck(SocketEvents.RejoinGame, {
        gameId: 'mixed-game',
        deviceId: alice.deviceId,
      }),
      bob.emitAck(SocketEvents.RejoinGame, {
        gameId: 'mixed-game',
        deviceId: bob.deviceId,
      }),
    ])

    const deadline = Date.now() + 5_000
    while (Date.now() < deadline) {
      const currentGame = server.handle.gameService.getGame('mixed-game')
      if (
        currentGame &&
        countPlacedTiles(
          server.handle.gameService.formatGameData(currentGame)
            .tilePlacesStats as GameStateSnapshot['tilePlacesStats']
        ) > beforeRestart
      ) {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error('Ходы ИИ не возобновились после возвращения людей')
  })

  it('возобновляет начатую партию только компьютерных игроков после перезапуска', async () => {
    server = await restartWithComputerGame()
    const restored = server.handle.gameService.getGame('computer-game')
    expect(restored?.gameIsStarted).toBe(true)
    expect(restored?.gameIsEnded).toBe(false)

    resumeComputerGames(server.handle.io, server.handle.gameService)

    await waitForCondition(
      () => server?.store.games['computer-game']?.gameIsEnded === true,
      'завершение восстановленной компьютерной партии'
    )
    expect(
      server.store.games['computer-game']?.tilePlacesStats[15]?.[15]
    ).toBeTruthy()
  })

  it('удаляет восстановленную компьютерную партию, если ход ИИ завершается ошибкой', async () => {
    server = await restartWithComputerGame()
    const restored = server.handle.gameService.getGame('computer-game')
    if (!restored) throw new Error('Сохранённая партия не восстановлена')
    restored.autoPlaceTile = async () => {
      throw new Error('simulated computer move failure')
    }

    resumeComputerGames(server.handle.io, server.handle.gameService)

    await waitForCondition(
      () => server?.handle.gameService.getGame('computer-game') === undefined,
      'удаление партии после ошибки хода ИИ'
    )
    expect(server.store.games['computer-game']).toBeUndefined()
  })

  it('повреждённое сохранение не мешает восстановлению остальных партий', async () => {
    const store = createInMemoryStore()
    const validGame = new GameManager({ players: [] })
    validGame.id = 'valid-game'
    store.games['invalid-game'] = '{invalid-json' as unknown as GameManager
    store.games['valid-game'] = JSON.parse(
      JSON.stringify(validGame)
    ) as GameManager

    server = await startTestServer(store)
    await server.handle.gameService.loadSavedGames()

    expect(server.handle.gameService.getGame('valid-game')?.id).toBe(
      'valid-game'
    )
    expect(server.handle.gameService.getGame('invalid-game')).toBeUndefined()
  })

  it('отказывает в загрузке базы и не подменяет ошибку пустым списком', async () => {
    const store = createInMemoryStore()
    server = await startTestServer(store)
    server.db.readError = new Error('database unavailable')

    await expect(server.handle.gameService.loadSavedGames()).rejects.toThrow(
      'database unavailable'
    )
  })
})
