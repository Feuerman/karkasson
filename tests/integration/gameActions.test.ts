import { afterEach, describe, expect, it } from 'vitest'
import { PLACEMENT_FAILURE_MESSAGE } from '@server/socket/handlers/placementErrors'
import { GameErrors, LobbyErrors } from '@server/modules/errors'
import { SocketEvents } from '@server/modules/types'
import { deserializeGameState } from '@server/modules/gameSave'
import { TestClient } from './helpers/client'
import {
  createLobbyWithPlayers,
  latestGame,
  type TestGameData,
} from './helpers/lobby'
import {
  findValidPlacement,
  isValidPosition,
  makeHumanMove,
  rotateSides,
  startGame,
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

  it('не отправляет клиенту историю тайлов, растущую с каждым ходом', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()

    const state = await startGame(lobby.creator, lobby.gameId)

    // Клиент историю тайлов не читает, а список растёт всю партию.
    expect(state).not.toHaveProperty('tileHistory')
    // История действий нужна интерфейсу и остаётся в состоянии.
    expect(Array.isArray(state.actionsHistory)).toBe(true)
  })

  it('сервер отклоняет чужие ходы: selectPlacingPoint, updateCurrentTile, placeFollower, skipFollower', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby

    const state = await startGame(lobby.creator, gameId)
    expect(state.currentPlayer?.name).toBe('Alice')

    const move = findValidPlacement(state)
    expect(move).not.toBeNull()

    // Боб пытается действовать на ходу Алисы
    await expect(
      lobby.joiner.emitAck(SocketEvents.SelectPlacingPoint, {
        gameId,
        point: { rowIndex: 15, tileIndex: 16 },
      })
    ).rejects.toThrow(GameErrors.NotPlayersTurn)

    await expect(
      lobby.joiner.emitAck(SocketEvents.UpdateCurrentTile, {
        gameId,
        rotation: move!.tile.rotation,
      })
    ).rejects.toThrow(GameErrors.NotPlayersTurn)

    await expect(
      lobby.joiner.emitAck(SocketEvents.PlaceFollower, {
        gameId,
        place: { point: { x: 0, y: 0 }, temporaryObject: { id: 'x' } },
      })
    ).rejects.toThrow(GameErrors.NotPlayersTurn)

    await expect(
      lobby.joiner.emitAck(SocketEvents.SkipFollower, { gameId })
    ).rejects.toThrow(GameErrors.NotPlayersTurn)

    // Алиса по-прежнему может ходить
    const after = (await makeHumanMove(lobby.creator, gameId, state)).game
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
    }>(SocketEvents.SelectPlacingPoint, {
      gameId,
      point: { rowIndex: place.rowIndex, tileIndex: place.tileIndex },
    })
    expect(selected.success).toBe(true)
    expect(selected.game.placingPoint).toMatchObject({
      rowIndex: place.rowIndex,
      tileIndex: place.tileIndex,
    })

    const move = findValidPlacement(state)
    expect(move).not.toBeNull()
    const updated = await lobby.creator.emitAck<{
      success: boolean
      game: { currentTile: TileSnapshot | null }
    }>(SocketEvents.UpdateCurrentTile, {
      gameId,
      rotation: move!.tile.rotation,
    })
    expect(updated.success).toBe(true)
    expect(updated.game.currentTile?.sides).toEqual(move!.tile.sides)

    // Игра при этом не сломалась: ход по-прежнему можно завершить
    const after = (await makeHumanMove(lobby.creator, gameId, state)).game
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
        const sides = rotateSides(tile.sides, rotation)
        if (!isValidPosition(state, sides, place.rowIndex, place.tileIndex)) {
          invalid = {
            tile: {
              ...tile,
              sides,
              rotation: (tile.rotation + rotation * 90) % 360,
            },
            place,
          }
          break
        }
      }
      if (invalid) break
    }

    // В базовой колоде всегда есть неподходящий поворот
    expect(invalid).toBeTruthy()

    const failure = await lobby.creator
      .emitAck<never>(SocketEvents.PlaceTile, {
        gameId,
        rotation: invalid!.tile.rotation,
        position: {
          rowIndex: invalid!.place.rowIndex,
          tileIndex: invalid!.place.tileIndex,
        },
      })
      .catch((error: Error) => error)

    expect(failure).toBeInstanceOf(Error)
    expect(failure.message).toContain(PLACEMENT_FAILURE_MESSAGE)
    expect(failure.message).toMatch(/(север|восток|юг|запад) —/)
    expect(failure.message).toMatch(/(поле|дорога|город)/)
  })

  it('сервер игнорирует подменённый тайл и сохраняет состояние до ack', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby
    const state = await startGame(lobby.creator, gameId)
    const move = findValidPlacement(state)
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
    }>(SocketEvents.PlaceTile, {
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
    const move = findValidPlacement(state)
    expect(move).not.toBeNull()
    const beforeTiles = Object.values(state.tilePlacesStats).reduce(
      (count, row) => count + Object.keys(row ?? {}).length,
      0
    )

    server.db.saveError = new Error('storage unavailable')
    await expect(
      lobby.creator.emitAck(SocketEvents.PlaceTile, {
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
    server.db.saveGame = async (_gameId, serializedState) => {
      const value = deserializeGameState(serializedState).moveCounter
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
      lobby.joiner.emitAck(SocketEvents.AddPlayer, {
        gameId,
        name: 'Mallory',
        index: 2,
      })
    ).rejects.toThrow(LobbyErrors.SlotEditForbidden)

    await expect(
      lobby.joiner.emitAck(SocketEvents.StartGame, { gameId })
    ).rejects.toThrow(LobbyErrors.OnlyLobbyOwnerCanStart)
  })

  it('leaveGame в начатой игре освобождает сокет, но сохраняет deviceId', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby

    const started = await startGame(lobby.creator, gameId)
    expect(started.gameIsStarted).toBe(true)

    // Боб «покидает» уже начатую игру
    lobby.joiner.emit(SocketEvents.LeaveGame, { gameId })
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
    lobby.joiner.emit(SocketEvents.RejoinGame, {
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

  it('skipFollower отклоняется вне фазы выставления фишек и не передаёт очередь', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby

    const state = await startGame(lobby.creator, gameId)
    expect(state.isPlacingFollower).toBe(false)

    await expect(
      lobby.creator.emitAck(SocketEvents.SkipFollower, { gameId })
    ).rejects.toThrow(GameErrors.NotPlacingFollower)

    // Очередь осталась у Алисы, ход не потрачен
    const after = await latestGame(
      lobby.creator,
      (g: TestGameData) => g.currentPlayer?.name === 'Alice'
    )
    expect(after.currentPlayerIndex).toBe(state.currentPlayerIndex)
    expect(after.tilesList.length).toBe(state.tilesList.length)
  })

  it('неудачное размещение тайла не оставляет поворот клиента в состоянии', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby

    const state = await startGame(lobby.creator, gameId)
    const move = findValidPlacement(state)
    expect(move).not.toBeNull()

    const game = server.handle.gameService.getGame(gameId)
    const rotationBefore = game?.currentTile?.rotation

    // Позиция занята стартовым тайлом, поэтому размещение обязано быть отклонено
    await expect(
      lobby.creator.emitAck(SocketEvents.PlaceTile, {
        gameId,
        rotation: 180,
        position: { rowIndex: 15, tileIndex: 15 },
      })
    ).rejects.toThrow()

    const live = server.handle.gameService.getGame(gameId)
    expect(live?.currentTile?.rotation).toBe(rotationBefore)
    expect(live?.currentPlayerIndex).toBe(state.currentPlayerIndex)

    const saved = await server.db.getGame(gameId)
    expect(saved?.currentTile?.rotation).toBe(rotationBefore)
  })

  it('выбор клетки и поворот тайла фиксируются в хранилище', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby
    const state = await startGame(lobby.creator, gameId)

    await lobby.creator.emitAck(SocketEvents.SelectPlacingPoint, {
      gameId,
      point: { rowIndex: 15, tileIndex: 16 },
    })
    const afterPoint = await server.db.getGame(gameId)
    expect(afterPoint?.placingPoint).toEqual({ rowIndex: 15, tileIndex: 16 })

    await lobby.creator.emitAck(SocketEvents.UpdateCurrentTile, {
      gameId,
      rotation: 180,
    })
    const afterRotation = await server.db.getGame(gameId)
    expect(afterRotation?.currentTile?.rotation).toBe(180)

    expect(state.gameIsStarted).toBe(true)
  })

  it('ошибка записи откатывает выбор клетки и поворот тайла', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby
    await startGame(lobby.creator, gameId)

    const game = server.handle.gameService.getGame(gameId)
    const rotationBefore = game?.currentTile?.rotation
    const pointBefore = game?.placingPoint

    server.db.saveError = new Error('storage unavailable')

    await expect(
      lobby.creator.emitAck(SocketEvents.SelectPlacingPoint, {
        gameId,
        point: { rowIndex: 15, tileIndex: 16 },
      })
    ).rejects.toThrow('storage unavailable')

    await expect(
      lobby.creator.emitAck(SocketEvents.UpdateCurrentTile, {
        gameId,
        rotation: 180,
      })
    ).rejects.toThrow('storage unavailable')

    const after = server.handle.gameService.getGame(gameId)
    expect(after?.currentTile?.rotation).toBe(rotationBefore)
    expect(after?.placingPoint).toEqual(pointBefore)
  })
})
