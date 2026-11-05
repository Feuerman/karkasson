import type { PlacementConflict } from '../../../modules/types'
import { describePlacementFailure } from '../placementErrors'
import { applyQuarterTurns } from '../../../modules/tileRotation'
import { findTileDefinition } from '../../../data/tileCatalog'
import { SocketEvents, TILE_ROTATIONS } from '../../../modules/types'
import type { SocketHandlerContext } from '../../types'
import type { GameManager } from '../../../modules/GameManager'
import { CommonErrors, GameErrors } from '../../../modules/errors'
import {
  parsePlaceTile,
  parseSelectPlacingPoint,
  parseUpdateCurrentTile,
  payloadAndCallback,
} from '../../validation'
import { errorResponse } from '../errorResponse'
import { GameCommandError, runGameCommand } from '../gameCommand'

/** Отказ разместить тайл: клиенту нужны и текст, и список конфликтов. */
class TilePlacementError extends GameCommandError {
  constructor(conflicts: PlacementConflict[]) {
    super(
      describePlacementFailure(conflicts),
      conflicts.length ? { conflicts } : {}
    )
  }
}

/**
 * Поворачивает текущий тайл на указанный угол.
 *
 * Форму берём из каталога, а поворот считает общий поворот тайла: стороны и
 * группы соединений поворачиваются вместе, иначе объект на доске перестал бы
 * совпадать с рисунком тайла.
 */
function setCurrentTileRotation(game: GameManager, rotation: number): boolean {
  const currentTile = game.currentTile
  if (
    !currentTile ||
    !TILE_ROTATIONS.includes(rotation as (typeof TILE_ROTATIONS)[number])
  ) {
    return false
  }

  const definition = findTileDefinition(currentTile.id, game.rules)
  if (!definition) return false

  const rotated = applyQuarterTurns(
    { ...definition, rotation: 0 },
    rotation / 90
  )
  game.currentTile = {
    ...currentTile,
    ...rotated,
    rotation,
    hasGarden: currentTile.hasGarden,
  }
  return true
}

export function registerTileHandlers(context: SocketHandlerContext) {
  const { events, service, scheduler, socket } = context

  socket.on(
    SocketEvents.SelectPlacingPoint,
    async (first: unknown, second: unknown) => {
      const { payload, callback } = payloadAndCallback(first, second)
      const request = parseSelectPlacingPoint(payload)
      if (!request) {
        callback?.(errorResponse(CommonErrors.InvalidRequest))
        return
      }
      const { gameId, position } = request

      await runGameCommand(context, {
        gameId,
        command: SocketEvents.SelectPlacingPoint,
        callback,
        transient: true,
        execute: async ({ game }) => {
          game.placingPoint = {
            rowIndex: position.rowIndex,
            tileIndex: position.tileIndex,
          }
        },
      })
    }
  )

  socket.on(
    SocketEvents.UpdateCurrentTile,
    async (first: unknown, second: unknown) => {
      const { payload, callback } = payloadAndCallback(first, second)
      const request = parseUpdateCurrentTile(payload)
      if (!request) {
        callback?.(errorResponse(CommonErrors.InvalidRequest))
        return
      }
      if (request.invalidRotation) {
        callback?.(errorResponse(GameErrors.InvalidTileRotation))
        return
      }
      const { gameId, rotation } = request

      await runGameCommand(context, {
        gameId,
        command: SocketEvents.UpdateCurrentTile,
        callback,
        transient: true,
        execute: async ({ game }) => {
          // Поворот меняет только предпросмотр: на правила он не влияет, и
          // сервер пересчитает стороны по присланному углу при постановке.
          if (
            game.isPlacingFollower ||
            game.princessChoice ||
            game.dragonMove ||
            typeof rotation !== 'number' ||
            !setCurrentTileRotation(game, rotation)
          ) {
            throw new Error(GameErrors.InvalidTileRotation)
          }
        },
      })
    }
  )

  socket.on(SocketEvents.PlaceTile, async (first: unknown, second: unknown) => {
    const { payload, callback } = payloadAndCallback(first, second)
    const request = parsePlaceTile(payload)
    if (!request) {
      callback?.(errorResponse(CommonErrors.InvalidRequest))
      return
    }
    if (request.invalidRotation) {
      callback?.(errorResponse(GameErrors.InvalidTileRotation))
      return
    }
    const { gameId, position, rotation } = request

    await runGameCommand(context, {
      gameId,
      command: SocketEvents.PlaceTile,
      callback,
      execute: async ({ game }) => {
        if (
          game.isPlacingFollower ||
          game.princessChoice ||
          game.dragonMove ||
          !game.currentTile
        ) {
          throw new Error(GameErrors.NoTileWaiting)
        }

        if (rotation !== undefined && !setCurrentTileRotation(game, rotation)) {
          throw new Error(GameErrors.InvalidTileRotation)
        }
        const isValidMove = game.placeTile(
          game.currentTile,
          position.rowIndex,
          position.tileIndex
        )
        if (!isValidMove) {
          const failedTile = game.currentTile
          throw new TilePlacementError(
            failedTile
              ? game.getPlacementConflicts(
                  failedTile,
                  position.rowIndex,
                  position.tileIndex
                )
              : []
          )
        }
      },
      afterSave: (game) => {
        scheduler.maybeContinue(events, service, game, gameId)
      },
    })
  })
}
