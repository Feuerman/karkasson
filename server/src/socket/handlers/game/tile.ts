import type { PlacementConflict, Tile } from '../../../modules/types'
import { describePlacementFailure } from '../placementErrors'
import { applyQuarterTurns } from '../../../modules/tileRotation'
import { findTileDefinition } from '../../../data/tileCatalog'
import { SocketEvents, TILE_ROTATIONS } from '../../../modules/types'
import type { SocketCallback, SocketHandlerContext } from '../../types'
import type { GameManager } from '../../../modules/GameManager'
import { GameErrors } from '../../../modules/errors'
import { GameCommandError, runGameCommand } from '../gameCommand'

function isValidPosition(position: { rowIndex: number; tileIndex: number }) {
  return (
    Number.isInteger(position.rowIndex) && Number.isInteger(position.tileIndex)
  )
}

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
    async (
      {
        gameId,
        point,
      }: { gameId: string; point: { rowIndex: number; tileIndex: number } },
      callback: SocketCallback
    ) => {
      await runGameCommand(context, {
        gameId,
        command: SocketEvents.SelectPlacingPoint,
        callback,
        transient: true,
        execute: async ({ game }) => {
          if (!point || !isValidPosition(point)) {
            throw new Error(GameErrors.InvalidTilePosition)
          }
          game.placingPoint = {
            rowIndex: point.rowIndex,
            tileIndex: point.tileIndex,
          }
        },
      })
    }
  )

  socket.on(
    SocketEvents.UpdateCurrentTile,
    async (
      {
        gameId,
        rotation,
        tile,
      }: { gameId: string; rotation?: number; tile?: Pick<Tile, 'rotation'> },
      callback: SocketCallback
    ) => {
      await runGameCommand(context, {
        gameId,
        command: SocketEvents.UpdateCurrentTile,
        callback,
        transient: true,
        execute: async ({ game }) => {
          // Поворот меняет только предпросмотр: на правила он не влияет, и
          // сервер пересчитает стороны по присланному углу при постановке.
          const requestedRotation = rotation ?? tile?.rotation
          if (
            game.isPlacingFollower ||
            game.princessChoice ||
            game.dragonMove ||
            typeof requestedRotation !== 'number' ||
            !setCurrentTileRotation(game, requestedRotation)
          ) {
            throw new Error(GameErrors.InvalidTileRotation)
          }
        },
      })
    }
  )

  socket.on(
    SocketEvents.PlaceTile,
    async (
      {
        gameId,
        rotation,
        position,
      }: {
        gameId: string
        rotation?: number
        position: { rowIndex: number; tileIndex: number }
      },
      callback: SocketCallback
    ) => {
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
          if (!isValidPosition(position)) {
            throw new Error(GameErrors.InvalidTilePosition)
          }

          if (
            rotation !== undefined &&
            !setCurrentTileRotation(game, rotation)
          ) {
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
    }
  )
}
