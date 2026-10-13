import type { PlacementConflict, Tile } from '../../../modules/types'
import { describePlacementFailure } from '../../../modules/gameGeometry'
import {
  rotateTileGroups,
  rotateTileSides,
} from '../../../modules/tileRotation'
import { findTileDefinitionById } from '../../../data/tileDefinitions'
import { maybeContinueWithComputerMove } from '../../../services/computerPlayer'
import { SocketEvents, TILE_ROTATIONS } from '../../../modules/types'
import type { SocketCallback, SocketHandlerContext } from '../../types'
import type { IGameBoard } from '../../../modules/GameManager'
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

function setCurrentTileRotation(game: IGameBoard, rotation: number): boolean {
  const currentTile = game.currentTile
  if (
    !currentTile ||
    !TILE_ROTATIONS.includes(rotation as (typeof TILE_ROTATIONS)[number])
  ) {
    return false
  }

  const definition = findTileDefinitionById(currentTile.id, game.rules)
  if (!definition) return false

  const quarterTurns = rotation / 90
  const sides = rotateTileSides(definition.sides, quarterTurns)

  const rotatedTile: Tile = {
    ...currentTile,
    ...definition,
    rotation,
    sides,
    roadGroups: rotateTileGroups(definition.roadGroups, quarterTurns),
    cityGroups: rotateTileGroups(definition.cityGroups, quarterTurns),
    cityShieldGroups: rotateTileGroups(
      definition.cityShieldGroups,
      quarterTurns
    ),
    riverGroups: rotateTileGroups(definition.riverGroups, quarterTurns),
    hasGarden: currentTile.hasGarden,
  }
  game.currentTile = { ...currentTile, ...rotatedTile }
  return true
}

export function registerTileHandlers(context: SocketHandlerContext) {
  const { events, service, socket } = context

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
        execute: async ({ game, save, ack }) => {
          if (!point || !isValidPosition(point)) {
            throw new Error(GameErrors.InvalidTilePosition)
          }
          game.placingPoint = {
            rowIndex: point.rowIndex,
            tileIndex: point.tileIndex,
          }
          await save()
          ack()
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
        execute: async ({ game, save, ack }) => {
          // Снимок берём до поворота: setCurrentTileRotation меняет
          // currentTile, и откат должен вернуть состояние до запроса.
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
          await save()
          ack()
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
        execute: async ({ game, save, ack }) => {
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
                ? game.getPlacementFailure(
                    failedTile,
                    position.rowIndex,
                    position.tileIndex
                  )
                : []
            )
          }

          await save()
          ack()
          maybeContinueWithComputerMove(events, service, game, gameId)
        },
      })
    }
  )
}
