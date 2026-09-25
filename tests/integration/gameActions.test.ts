import { afterEach, describe, expect, it } from 'vitest'
import { TestClient } from './helpers/client'
import {
  createLobbyWithPlayers,
  latestGame,
  type TestGameData,
} from './helpers/lobby'
import {
  findValidPlacement,
  isValidPosition,
  startGame,
  type GameStateSnapshot,
  type TileSnapshot,
} from './helpers/gameplay'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'

describe('Действия в игре: валидация ходов', () => {
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

  /** Лобби: Алиса (слот 0), Боб (слот 1), два ИИ */
  async function lobbyWithTwoHumans() {
    const lobby = await createLobbyWithPlayers(server!.url)
    clients.push(lobby.creator, lobby.joiner)
    return lobby
  }

  it('сервер отклоняет чужие ходы: selectPlacingPoint, updateCurrentTile, placeFollower, skipFollower', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby

    const state = await startGame(lobby.creator, gameId)
    expect(state.currentPlayer?.name).toBe('Alice')

    const move = findValidPlacement(state as GameStateSnapshot)
    expect(move).not.toBeNull()

    // Боб пытается действовать на ходу Алисы
    await expect(
      lobby.joiner.emitAck('selectPlacingPoint', {
        gameId,
        point: { rowIndex: 15, tileIndex: 16 },
      })
    ).rejects.toThrow("Not player's turn")

    await expect(
      lobby.joiner.emitAck('updateCurrentTile', {
        gameId,
        rotation: move!.tile.rotation,
      })
    ).rejects.toThrow("Not player's turn")

    await expect(
      lobby.joiner.emitAck('placeFollower', {
        gameId,
        place: { point: { x: 0, y: 0 }, temporaryObject: { id: 'x' } },
      })
    ).rejects.toThrow("Not player's turn")

    await expect(
      lobby.joiner.emitAck('skipFollower', { gameId })
    ).rejects.toThrow("Not player's turn")

    // Алиса по-прежнему может ходить
    const after = await makeAliceTurn(lobby.creator, gameId, state)
    expect(after.gameIsStarted).toBe(true)
  })

  it('selectPlacingPoint и updateCurrentTile проходят в свой ход и меняют состояние', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby

    const state = await startGame(lobby.creator, gameId)
    const place = state.availablePlacesTiles![0]

    const selected = await lobby.creator.emitAck<{
      success: boolean
      game: { placingPoint: { rowIndex: number; tileIndex: number } }
    }>('selectPlacingPoint', {
      gameId,
      point: { rowIndex: place.rowIndex, tileIndex: place.tileIndex },
    })
    expect(selected.success).toBe(true)
    expect(selected.game.placingPoint).toMatchObject({
      rowIndex: place.rowIndex,
      tileIndex: place.tileIndex,
    })

    const move = findValidPlacement(state as GameStateSnapshot)
    expect(move).not.toBeNull()
    const updated = await lobby.creator.emitAck<{
      success: boolean
      game: { currentTile: TileSnapshot | null }
    }>('updateCurrentTile', { gameId, rotation: move!.tile.rotation })
    expect(updated.success).toBe(true)
    expect(updated.game.currentTile?.sides).toEqual(move!.tile.sides)

    // Игра при этом не сломалась: ход по-прежнему можно завершить
    const after = await makeAliceTurn(lobby.creator, gameId, state)
    expect(after.gameIsStarted).toBe(true)
  })

  it('сервер отклоняет размещение тайла с неподходящим поворотом', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby

    const state = await startGame(lobby.creator, gameId)
    const tile = state.currentTile!
    expect(tile.sides).toBeTruthy()

    // Подбираем позицию и поворот, при котором стороны НЕ сходятся
    let invalid:
      | {
          tile: TileSnapshot
          place: { rowIndex: number; tileIndex: number }
        }
      | undefined

    for (const place of state.availablePlacesTiles ?? []) {
      for (let rotation = 1; rotation < 4; rotation++) {
        const candidate = rotateTileState(tile, rotation)
        if (
          !isValidPosition(
            state,
            candidate.sides,
            place.rowIndex,
            place.tileIndex
          )
        ) {
          invalid = { tile: candidate, place }
          break
        }
      }
      if (invalid) break
    }

    // В базовой колоде всегда есть неподходящий поворот
    expect(invalid).toBeTruthy()

    await expect(
      lobby.creator.emitAck('placeTile', {
        gameId,
        rotation: invalid!.tile.rotation,
        position: {
          rowIndex: invalid!.place.rowIndex,
          tileIndex: invalid!.place.tileIndex,
        },
      })
    ).rejects.toThrow('Невозможно разместить тайл на данной позиции')
  })

  it('сервер игнорирует подменённый тайл и сохраняет состояние до ack', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby
    const state = await startGame(lobby.creator, gameId)
    const move = findValidPlacement(state as GameStateSnapshot)
    expect(move).not.toBeNull()

    const before = server.handle.gameService.getGame(gameId)?.currentTile
    const originalSave = server.db.saveGame.bind(server.db)
    const saveGate = new Promise<void>((resolve) => setTimeout(resolve, 100))
    server.db.saveGame = async (id, gameState) => {
      await saveGate
      await originalSave(id, gameState)
    }

    const placing = lobby.creator.emitAck<{
      success: boolean
      game: TestGameData
    }>('placeTile', {
      gameId,
      rotation: move!.tile.rotation,
      position: { rowIndex: move!.rowIndex, tileIndex: move!.tileIndex },
      tile: { ...move!.tile, id: 'INVALID', sides: {} },
    })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(server.handle.gameService.getGame(gameId)?.currentTile).not.toBe(
      before
    )
    const savedBeforeMove = await server.db.getGame(gameId)
    expect(
      savedBeforeMove?.tilePlacesStats[move!.rowIndex]?.[move!.tileIndex]
    ).toBeUndefined()

    const response = await placing
    expect(response.success).toBe(true)
    const placed =
      response.game.tilePlacesStats[move!.rowIndex]?.[move!.tileIndex]
    expect(placed?.id).toBe(before?.id)
    const savedAfterMove = await server.db.getGame(gameId)
    expect(
      savedAfterMove?.tilePlacesStats[move!.rowIndex]?.[move!.tileIndex]?.id
    ).toBe(before?.id)
  })

  it('ошибка записи откатывает действие и не подтверждает ход', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby
    const state = await startGame(lobby.creator, gameId)
    const move = findValidPlacement(state as GameStateSnapshot)
    expect(move).not.toBeNull()
    const beforeTiles = Object.values(state.tilePlacesStats).reduce(
      (count, row) => count + Object.keys(row ?? {}).length,
      0
    )

    server.db.saveError = new Error('storage unavailable')
    await expect(
      lobby.creator.emitAck('placeTile', {
        gameId,
        rotation: move!.tile.rotation,
        position: { rowIndex: move!.rowIndex, tileIndex: move!.tileIndex },
      })
    ).rejects.toThrow('storage unavailable')

    const current = server.handle.gameService.getGame(gameId)
    expect(current?.tilePlacesStats[move!.rowIndex]?.[move!.tileIndex]).toBe(
      undefined
    )
    expect(
      Object.values(current?.tilePlacesStats ?? {}).reduce(
        (count, row) => count + Object.keys(row ?? {}).length,
        0
      )
    ).toBe(beforeTiles)
  })

  it('последовательные сохранения одной игры не записываются вразнобой', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const game = server.handle.gameService.getGame(lobby.gameId)
    expect(game).toBeTruthy()

    const savedStates: number[] = []
    server.db.saveGame = async (_gameId, state) => {
      const value = state.moveCounter
      if (value === 1) await new Promise((resolve) => setTimeout(resolve, 40))
      savedStates.push(value)
    }

    if (game) game.moveCounter = 1
    const first = server.handle.gameService.saveGame(lobby.gameId)
    if (game) game.moveCounter = 2
    const second = server.handle.gameService.saveGame(lobby.gameId)
    await Promise.all([first, second])

    expect(savedStates).toEqual([1, 2])
  })

  it('участник не может управлять чужими слотами или начинать лобби', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby

    await expect(
      lobby.joiner.emitAck('addPlayer', {
        gameId,
        name: 'Mallory',
        index: 2,
      })
    ).rejects.toThrow('Недостаточно прав')

    await expect(lobby.joiner.emitAck('startGame', { gameId })).rejects.toThrow(
      'Только создатель лобби'
    )
  })

  it('leaveGame в начатой игре освобождает сокет, но сохраняет deviceId', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby

    const started = await startGame(lobby.creator, gameId)
    expect(started.gameIsStarted).toBe(true)

    // Боб «покидает» уже начатую игру
    lobby.joiner.emit('leaveGame', { gameId })
    const afterLeave = await latestGame(
      lobby.creator,
      (g: TestGameData) =>
        g.gameIsStarted === true && g.players[1]?.socketId === null
    )
    expect(afterLeave.gameIsStarted).toBe(true)
    expect(afterLeave.players[1].deviceId).toBe('device-joiner')
    expect(afterLeave.players[1].name).toBe('Bob')

    // Игра не удалена
    expect(server.handle.gameService.getGame(gameId)).toBeTruthy()

    // Боб может вернуться по устройству
    lobby.joiner.reconnect()
    await lobby.joiner.connect()
    lobby.joiner.registerDevice()
    lobby.joiner.emit('rejoinGame', {
      gameId,
      deviceId: lobby.joiner.deviceId,
    })
    const rejoined = await latestGame(
      lobby.joiner,
      (g: TestGameData) =>
        g.gameIsStarted === true && g.players[1]?.socketId === lobby.joiner.id
    )
    expect(rejoined.players[1].socketId).toBe(lobby.joiner.id)
  })
})

/** Поворачивает стороны тайла state-среза (зеркало rotateTile) */
function rotateTileState(
  tile: TileSnapshot,
  rotation: number,
  current = { ...tile.sides }
): TileSnapshot {
  let sides = current
  for (let i = 0; i < rotation; i++) {
    sides = {
      ...sides,
      north: sides.west,
      east: sides.north,
      south: sides.east,
      west: sides.south,
    }
  }
  return { ...tile, sides, rotation: (tile.rotation + rotation * 90) % 360 }
}

/** Полный ход Алисы: тайл + (при необходимости) скип фишки */
async function makeAliceTurn(
  creator: TestClient,
  gameId: string,
  state: GameStateSnapshot
) {
  const move = findValidPlacement(state)
  if (!move) throw new Error('Не найдено легальное место для текущего тайла')

  await creator.emitAck('updateCurrentTile', {
    gameId,
    rotation: move.tile.rotation,
  })
  const placed = await creator.emitAck<{
    success: boolean
    game: TestGameData & { isPlacingFollower?: boolean }
  }>('placeTile', {
    gameId,
    position: { rowIndex: move.rowIndex, tileIndex: move.tileIndex },
  })
  expect(placed.success).toBe(true)

  let game = placed.game
  if (game.isPlacingFollower) {
    game = (
      await creator.emitAck<{ success: boolean; game: TestGameData }>(
        'skipFollower',
        { gameId }
      )
    ).game
  }
  return game
}
