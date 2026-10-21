import { describe, expect, it } from 'vitest'
import { CommonErrors, GameErrors } from '@server/modules/errors'
import type { GameManager } from '@server/modules/GameManager'
import { SocketEvents, type Tile } from '@server/modules/types'
import { TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import { createLobbyWithPlayers, type LobbySetup } from './helpers/lobby'
import {
  alternateRotation,
  startGame,
  type GameAck,
  type GameStateSnapshot,
} from './helpers/gameplay'
import { failNextSave } from './helpers/storage'
import { sleep } from './helpers/wait'
import { startTestServer, type RunningServer } from './helpers/server'

describe('Конкурентные команды одной партии', () => {
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

  interface StartedTwoHumanGame {
    server: RunningServer
    gameId: string
    lobby: LobbySetup
    state: GameStateSnapshot
  }

  /** Партия двух людей: чужая команда должна отклоняться по очереди хода. */
  async function startedGameWithTwoHumans(): Promise<StartedTwoHumanGame> {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)
    const state = await startGame(lobby.creator, lobby.gameId)
    return { server, gameId: lobby.gameId, lobby, state }
  }

  it('команда чужой партии отклоняется, пока очередь занята ходом', async () => {
    const { server, gameId, lobby, state } = await startedGameWithTwoHumans()
    const rotation = alternateRotation(state)

    // Алиса поворачивает тайл; пока команда не выполнена, очередь занята ходом.
    // Поворот выбран намеренно: он не двигает очередь, поэтому проверка не
    // зависит от того, остались ли у выложенного тайла места для фишек.
    const rotating = lobby.creator.emitAck(SocketEvents.UpdateCurrentTile, {
      gameId,
      rotation,
    })
    await sleep(20)
    // Отказ команды обрабатывается сразу: иначе промис без обработчика
    // выглядит для Node как потерянное обещание.
    const intruder = lobby.joiner
      .emitAck(SocketEvents.SelectPlacingPoint, {
        gameId,
        point: { rowIndex: 15, tileIndex: 16 },
      })
      .then(
        () => undefined,
        (error: unknown) => error
      )

    await rotating
    const intruderError = await intruder
    expect(intruderError).toBeInstanceOf(Error)
    expect((intruderError as Error).message).toBe(GameErrors.NotPlayersTurn)

    const live = server.handle.gameService.getGame(gameId)
    expect(live?.currentTile?.rotation).toBe(rotation)
    // Чужая команда не применилась: выбранная точка осталась прежней
    expect(live?.placingPoint).toEqual(state.placingPoint)
    expect(live?.currentPlayerIndex).toBe(state.currentPlayerIndex)
  })

  /**
   * Клетка и поворот, на которых тайл встанет: размещение проверяет сам
   * сервер, поэтому ищется тем же правилом.
   */
  function findPlacement(game: GameManager):
    | {
        rowIndex: number
        tileIndex: number
        rotation: number
      }
    | undefined {
    const tile = game.currentTile
    if (!tile) return undefined

    for (const rotation of [0, 90, 180, 270]) {
      let rotated: Tile = { ...tile, rotation: 0 }
      for (let turn = 0; turn < rotation / 90; turn += 1) {
        rotated = game.rotateTile(rotated)
      }
      for (const place of game.availablePlacesTiles) {
        if (
          game.getPlacementConflicts(rotated, place.rowIndex, place.tileIndex)
            .length === 0
        ) {
          return {
            rowIndex: place.rowIndex,
            tileIndex: place.tileIndex,
            rotation,
          }
        }
      }
    }
    return undefined
  }

  it('откат неудачной команды не затирает следующую команду', async () => {
    const { server, gameId, lobby, state } = await startedGameWithTwoHumans()
    const point = { rowIndex: 15, tileIndex: 16 }
    const live = server.handle.gameService.getGame(gameId)
    const placement = live ? findPlacement(live) : undefined
    if (!placement) throw new Error('Нет подходящей клетки для тайла')

    // Первая команда падает на записи и откатывается уже после того, как
    // вторая успела изменить состояние.
    const gate = failNextSave(server.db, new Error('storage unavailable'))

    const placing = lobby.creator.emitAck(SocketEvents.PlaceTile, {
      gameId,
      rotation: placement.rotation,
      position: {
        rowIndex: placement.rowIndex,
        tileIndex: placement.tileIndex,
      },
    })
    const selecting = lobby.creator.emitAck(SocketEvents.SelectPlacingPoint, {
      gameId,
      point,
    })

    await expect(placing).rejects.toThrow(CommonErrors.InternalFailure)
    await expect(selecting).resolves.toMatchObject({ success: true })
    await gate

    const after = server.handle.gameService.getGame(gameId)
    // Тайл откатился: на доске остался только стартовый, очередь не сдвинулась.
    expect(
      after?.tilePlacesStats[placement.rowIndex]?.[placement.tileIndex]
    ).toBeUndefined()
    expect(after?.currentPlayerIndex).toBe(state.currentPlayerIndex)
    expect(after?.placingPoint).toEqual(point)
  })

  it('параллельные команды одного игрока дают согласованное состояние', async () => {
    const { server, gameId, lobby, state } = await startedGameWithTwoHumans()
    const rotation = alternateRotation(state)
    const point = { rowIndex: 15, tileIndex: 16 }

    // Клиент шлёт обе команды, не дожидаясь первой: сервер обязан выполнить
    // их последовательно и оставить память согласованной.
    const [rotated, selected] = await Promise.all([
      lobby.creator.emitAck<GameAck>(SocketEvents.UpdateCurrentTile, {
        gameId,
        rotation,
      }),
      lobby.creator.emitAck<GameAck>(SocketEvents.SelectPlacingPoint, {
        gameId,
        point,
      }),
    ])

    expect(rotated.success).toBe(true)
    expect(selected.success).toBe(true)

    const live = server.handle.gameService.getGame(gameId)
    expect(live?.currentTile?.rotation).toBe(rotation)
    expect(live?.placingPoint).toEqual(point)
  })
})
