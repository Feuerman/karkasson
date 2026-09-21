import { afterEach, describe, expect, it } from 'vitest'
import { TestClient } from './helpers/client'
import {
  createLobbyWithPlayers,
  latestGame,
  type TestGameData,
} from './helpers/lobby'
import { findValidPlacement, type GameStateSnapshot } from './helpers/gameplay'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'

describe('Запуск игры', () => {
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

  it('стартует игру с реальными и компьютерными игроками', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    lobby.creator.emit('startGame', { gameId: lobby.gameId })
    const started = (await latestGame(
      lobby.creator,
      (g) => g.gameIsStarted === true
    )) as TestGameData

    expect(started.id).toBe(lobby.gameId)
    expect(started.gameIsStarted).toBe(true)
    expect(started.gameIsEnded).toBe(false)
    expect(started.players).toHaveLength(4)
    expect(started.currentPlayerIndex).toBe(0)
    expect(started.currentPlayer?.name).toBe('Alice')

    // Компьютерные игроки попали в игру
    const aiPlayers = started.players.filter(
      (p) => p.name && !p.socketId && !p.deviceId
    )
    expect(aiPlayers).toHaveLength(2)

    // Стартовый тайл размещён в центре доски
    expect(started.tilePlacesStats[15]?.[15]).toBeTruthy()

    // Счёт обнулён, меппы и текущий тайл на месте
    expect(started.scores).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0 })
    expect(started.currentTile).toBeTruthy()
    expect(started.tilesList.length).toBeGreaterThan(0)
  })

  it('реальный игрок размещает тайл, и ход переходит к следующему игроку', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    lobby.creator.emit('startGame', { gameId: lobby.gameId })
    const started = (await latestGame(
      lobby.creator,
      (g) => g.gameIsStarted === true
    )) as TestGameData

    const move = findValidPlacement(started as GameStateSnapshot)
    expect(move).not.toBeNull()

    const placed = await lobby.creator.emitAck<{
      success: boolean
      game: TestGameData & { isPlacingFollower?: boolean }
    }>('placeTile', {
      gameId: lobby.gameId,
      tile: move!.tile,
      position: { rowIndex: move!.rowIndex, tileIndex: move!.tileIndex },
    })
    expect(placed.success).toBe(true)

    let state = placed.game

    // Иногда размещённый тайл замыкает город/дорогу — тогда мипла поставить
    // нельзя и сервер завершает ход сразу; иначе пропускаем размещение мипла.
    if (state.isPlacingFollower) {
      const skipped = await lobby.creator.emitAck<{
        success: boolean
        game: TestGameData
      }>('skipFollower', { gameId: lobby.gameId })
      expect(skipped.success).toBe(true)
      state = skipped.game
    }

    // Ход перешёл к Бобу (реальный игрок)
    expect(state.currentPlayerIndex).toBe(1)
    expect(state.currentPlayer?.name).toBe('Bob')

    // Тайл реально лежит на доске (событие обновления игры)
    const placedTiles = Object.values(state.tilePlacesStats).reduce(
      (count, row) => count + Object.keys(row ?? {}).length,
      0
    )
    expect(placedTiles).toBeGreaterThanOrEqual(2)
    expect(state.tilePlacesStats[15][15]).toBeTruthy()

    // Состояние игры сохранено в хранилище
    const saved = await server.db.getGame(lobby.gameId)
    expect(saved?.gameIsStarted).toBe(true)
    expect(saved?.tilePlacesStats[15][15]).toBeTruthy()
    expect(saved?.players[0]).toMatchObject({ name: 'Alice' })
    expect(saved?.players[1]).toMatchObject({ name: 'Bob' })
  })
})
