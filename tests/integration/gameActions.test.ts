import { describe, expect, it } from 'vitest'
import { PLACEMENT_FAILURE_MESSAGE } from '@server/socket/handlers/placementErrors'
import { CommonErrors, GameErrors, LobbyErrors } from '@server/modules/errors'
import { SocketEvents } from '@server/modules/types'
import { deserializeGameState } from '@server/modules/gameSave'
import { TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import {
  createLobbyWithPlayers,
  latestGame,
  type TestGameData,
} from './helpers/lobby'
import {
  countPlacedTiles,
  makeHumanMove,
  requireInvalidPlacement,
  requireValidPlacement,
  startGame,
  type TileSnapshot,
} from './helpers/gameplay'
import { startTestServer, type RunningServer } from './helpers/server'

interface TestLobby {
  server: RunningServer
  gameId: string
  creator: TestClient
  joiner: TestClient
}

describe('Действия в игре: валидация ходов', () => {
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

  /** Сервер и лобби теста: Алиса (слот 0), Боб (слот 1), два ИИ */
  async function startLobby(): Promise<TestLobby> {
    const running = await startTestServer()
    server = running
    const lobby = await createLobbyWithPlayers(running.url)
    clients.push(lobby.creator, lobby.joiner)
    return { server: running, ...lobby }
  }

  it('не отправляет клиенту историю тайлов, растущую с каждым ходом', async () => {
    const { gameId, creator } = await startLobby()

    const state = await startGame(creator, gameId)

    // Клиент историю тайлов не читает, а список растёт всю партию.
    expect(state).not.toHaveProperty('tileHistory')
    // История действий нужна интерфейсу и остаётся в состоянии.
    expect(Array.isArray(state.actionsHistory)).toBe(true)
  })

  it('сервер отклоняет чужие ходы: selectPlacingPoint, updateCurrentTile, placeFollower, skipFollower', async () => {
    const { creator, joiner, gameId } = await startLobby()

    const state = await startGame(creator, gameId)
    expect(state.currentPlayer?.name).toBe('Alice')

    const move = requireValidPlacement(state)

    // Боб пытается действовать на ходу Алисы
    await expect(
      joiner.emitAck(SocketEvents.SelectPlacingPoint, {
        gameId,
        point: { rowIndex: 15, tileIndex: 16 },
      })
    ).rejects.toThrow(GameErrors.NotPlayersTurn)

    await expect(
      joiner.emitAck(SocketEvents.UpdateCurrentTile, {
        gameId,
        rotation: move.tile.rotation,
      })
    ).rejects.toThrow(GameErrors.NotPlayersTurn)

    await expect(
      joiner.emitAck(SocketEvents.PlaceFollower, {
        gameId,
        place: { point: { x: 0, y: 0 }, temporaryObject: { id: 'x' } },
      })
    ).rejects.toThrow(GameErrors.NotPlayersTurn)

    await expect(
      joiner.emitAck(SocketEvents.SkipFollower, { gameId })
    ).rejects.toThrow(GameErrors.NotPlayersTurn)

    // Алиса по-прежнему может ходить
    const after = (await makeHumanMove(creator, gameId, state)).game
    expect(after.gameIsStarted).toBe(true)
  })

  it('selectPlacingPoint и updateCurrentTile проходят в свой ход и меняют состояние', async () => {
    const { creator, gameId } = await startLobby()

    const state = await startGame(creator, gameId)
    const place = state.availablePlacesTiles![0]

    const selected = await creator.emitAck<{
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

    const move = requireValidPlacement(state)
    const updated = await creator.emitAck<{
      success: boolean
      game: { currentTile: TileSnapshot | null }
    }>(SocketEvents.UpdateCurrentTile, {
      gameId,
      rotation: move.tile.rotation,
    })
    expect(updated.success).toBe(true)
    expect(updated.game.currentTile?.sides).toEqual(move.tile.sides)

    // Игра при этом не сломалась: ход по-прежнему можно завершить
    const after = (await makeHumanMove(creator, gameId, state)).game
    expect(after.gameIsStarted).toBe(true)
  })

  it('сервер отклоняет размещение тайла с неподходящим поворотом', async () => {
    const { creator, gameId } = await startLobby()

    const state = await startGame(creator, gameId)
    // В базовой колоде всегда есть неподходящий поворот
    const invalid = requireInvalidPlacement(state)

    const failure = await creator
      .emitAck<never>(SocketEvents.PlaceTile, {
        gameId,
        rotation: invalid.tile.rotation,
        position: {
          rowIndex: invalid.rowIndex,
          tileIndex: invalid.tileIndex,
        },
      })
      .catch((error: Error) => error)

    expect(failure).toBeInstanceOf(Error)
    expect(failure.message).toContain(PLACEMENT_FAILURE_MESSAGE)
    expect(failure.message).toMatch(
      /(северной|восточной|южной|западной) стороне/
    )
    expect(failure.message).toMatch(/(поле|дорога|город)/)
  })

  it('сервер игнорирует подменённый тайл и сохраняет состояние до ack', async () => {
    const { server: running, creator, gameId } = await startLobby()
    const state = await startGame(creator, gameId)
    const move = requireValidPlacement(state)

    const before = running.handle.gameService.getGame(gameId)?.currentTile
    const originalSave = running.db.saveGame.bind(running.db)
    const saveGate = new Promise<void>((resolve) => setTimeout(resolve, 100))
    running.db.saveGame = async (id, gameState) => {
      await saveGate
      await originalSave(id, gameState)
    }

    const placing = creator.emitAck<{
      success: boolean
      game: TestGameData
    }>(SocketEvents.PlaceTile, {
      gameId,
      rotation: move.tile.rotation,
      position: { rowIndex: move.rowIndex, tileIndex: move.tileIndex },
      tile: { ...move.tile, id: 'INVALID', sides: {} },
    })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(running.handle.gameService.getGame(gameId)?.currentTile).not.toBe(
      before
    )
    const savedBeforeMove = await running.db.getGame(gameId)
    expect(
      savedBeforeMove?.tilePlacesStats[move.rowIndex]?.[move.tileIndex]
    ).toBeUndefined()

    const response = await placing
    expect(response.success).toBe(true)
    const placed =
      response.game.tilePlacesStats[move.rowIndex]?.[move.tileIndex]
    expect(placed?.id).toBe(before?.id)
    const savedAfterMove = await running.db.getGame(gameId)
    expect(
      savedAfterMove?.tilePlacesStats[move.rowIndex]?.[move.tileIndex]?.id
    ).toBe(before?.id)
  })

  it('ошибка записи откатывает действие и не подтверждает ход', async () => {
    const { server: running, creator, gameId } = await startLobby()
    const state = await startGame(creator, gameId)
    const move = requireValidPlacement(state)
    const beforeTiles = countPlacedTiles(state.tilePlacesStats)

    running.db.saveError = new Error('storage unavailable')
    await expect(
      creator.emitAck(SocketEvents.PlaceTile, {
        gameId,
        rotation: move.tile.rotation,
        position: { rowIndex: move.rowIndex, tileIndex: move.tileIndex },
      })
    ).rejects.toThrow(CommonErrors.InternalFailure)

    const current = running.handle.gameService.getGame(gameId)
    expect(current?.tilePlacesStats[move.rowIndex]?.[move.tileIndex]).toBe(
      undefined
    )
    expect(countPlacedTiles(current?.tilePlacesStats ?? {})).toBe(beforeTiles)
  })

  it('последовательные сохранения одной игры не записываются вразнобой', async () => {
    const { server: running, gameId } = await startLobby()
    const game = running.handle.gameService.getGame(gameId)
    expect(game).toBeTruthy()

    const savedStates: number[] = []
    running.db.saveGame = async (_gameId, serializedState) => {
      const value = deserializeGameState(serializedState).moveCounter
      if (value === 1) await new Promise((resolve) => setTimeout(resolve, 40))
      savedStates.push(value)
    }

    if (game) game.moveCounter = 1
    const first = running.handle.gameService.saveGame(gameId)
    if (game) game.moveCounter = 2
    const second = running.handle.gameService.saveGame(gameId)
    await Promise.all([first, second])

    expect(savedStates).toEqual([1, 2])
  })

  it('участник не может управлять чужими слотами или начинать лобби', async () => {
    const { joiner, gameId } = await startLobby()

    await expect(
      joiner.emitAck(SocketEvents.AddPlayer, {
        gameId,
        name: 'Mallory',
        index: 2,
      })
    ).rejects.toThrow(LobbyErrors.SlotEditForbidden)

    await expect(
      joiner.emitAck(SocketEvents.StartGame, { gameId })
    ).rejects.toThrow(LobbyErrors.OnlyLobbyOwnerCanStart)
  })

  it('leaveGame в начатой игре освобождает сокет, но сохраняет deviceId', async () => {
    const { server: running, creator, joiner, gameId } = await startLobby()

    const started = await startGame(creator, gameId)
    expect(started.gameIsStarted).toBe(true)

    // Боб «покидает» уже начатую игру
    joiner.emit(SocketEvents.LeaveGame, { gameId })
    const afterLeave = await latestGame(
      creator,
      (g: TestGameData) =>
        g.gameIsStarted === true && g.players[1]?.socketId === null
    )
    expect(afterLeave.gameIsStarted).toBe(true)
    expect(afterLeave.players[1].deviceId).toBe('device-joiner')
    expect(afterLeave.players[1].name).toBe('Bob')

    // Игра не удалена
    expect(running.handle.gameService.getGame(gameId)).toBeTruthy()

    // Боб может вернуться по устройству
    joiner.reconnect()
    await joiner.connect()
    joiner.registerDevice()
    joiner.emit(SocketEvents.RejoinGame, {
      gameId,
      deviceId: joiner.deviceId,
    })
    const rejoined = await latestGame(
      joiner,
      (g: TestGameData) =>
        g.gameIsStarted === true && g.players[1]?.socketId === joiner.id
    )
    expect(rejoined.players[1].socketId).toBe(joiner.id)
  })

  it('skipFollower отклоняется вне фазы выставления фишек и не передаёт очередь', async () => {
    const { creator, gameId } = await startLobby()

    const state = await startGame(creator, gameId)
    expect(state.isPlacingFollower).toBe(false)

    await expect(
      creator.emitAck(SocketEvents.SkipFollower, { gameId })
    ).rejects.toThrow(GameErrors.NotPlacingFollower)

    // Очередь осталась у Алисы, ход не потрачен
    const after = await latestGame(
      creator,
      (g: TestGameData) => g.currentPlayer?.name === 'Alice'
    )
    expect(after.currentPlayerIndex).toBe(state.currentPlayerIndex)
    expect(after.tilesList.length).toBe(state.tilesList.length)
  })

  it('неудачное размещение тайла не оставляет поворот клиента в состоянии', async () => {
    const { server: running, creator, gameId } = await startLobby()

    const state = await startGame(creator, gameId)

    const game = running.handle.gameService.getGame(gameId)
    const rotationBefore = game?.currentTile?.rotation

    // Позиция занята стартовым тайлом, поэтому размещение обязано быть отклонено
    await expect(
      creator.emitAck(SocketEvents.PlaceTile, {
        gameId,
        rotation: 180,
        position: { rowIndex: 15, tileIndex: 15 },
      })
    ).rejects.toThrow()

    const live = running.handle.gameService.getGame(gameId)
    expect(live?.currentTile?.rotation).toBe(rotationBefore)
    expect(live?.currentPlayerIndex).toBe(state.currentPlayerIndex)

    const saved = await running.db.getGame(gameId)
    expect(saved?.currentTile?.rotation).toBe(rotationBefore)
  })

  it('выбор клетки и поворот тайла фиксируются в хранилище', async () => {
    const { server: running, creator, gameId } = await startLobby()
    const state = await startGame(creator, gameId)

    await creator.emitAck(SocketEvents.SelectPlacingPoint, {
      gameId,
      point: { rowIndex: 15, tileIndex: 16 },
    })
    const afterPoint = await running.db.getGame(gameId)
    expect(afterPoint?.placingPoint).toEqual({ rowIndex: 15, tileIndex: 16 })

    await creator.emitAck(SocketEvents.UpdateCurrentTile, {
      gameId,
      rotation: 180,
    })
    const afterRotation = await running.db.getGame(gameId)
    expect(afterRotation?.currentTile?.rotation).toBe(180)

    expect(state.gameIsStarted).toBe(true)
  })

  it('ошибка записи откатывает выбор клетки и поворот тайла', async () => {
    const { server: running, creator, gameId } = await startLobby()
    await startGame(creator, gameId)

    const game = running.handle.gameService.getGame(gameId)
    const rotationBefore = game?.currentTile?.rotation
    const pointBefore = game?.placingPoint

    running.db.saveError = new Error('storage unavailable')

    await expect(
      creator.emitAck(SocketEvents.SelectPlacingPoint, {
        gameId,
        point: { rowIndex: 15, tileIndex: 16 },
      })
    ).rejects.toThrow(CommonErrors.InternalFailure)

    await expect(
      creator.emitAck(SocketEvents.UpdateCurrentTile, {
        gameId,
        rotation: 180,
      })
    ).rejects.toThrow(CommonErrors.InternalFailure)

    const after = running.handle.gameService.getGame(gameId)
    expect(after?.currentTile?.rotation).toBe(rotationBefore)
    expect(after?.placingPoint).toEqual(pointBefore)
  })
})
