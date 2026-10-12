import type {
  AvailableFollowerPlace,
  FollowerType,
  PlacementConflict,
  Point,
  Tile,
} from '../../modules/types'
import { describePlacementFailure } from '../../modules/gameGeometry'
import { rotateTileGroups, rotateTileSides } from '../../modules/tileRotation'
import { findTileDefinitionById } from '../../data/tileDefinitions'
import { maybeContinueWithComputerMove } from '../../services/computerPlayer'
import {
  FollowerType as FollowerTypes,
  SocketEvents,
  TILE_ROTATIONS,
} from '../../modules/types'
import type { SocketCallback, SocketHandlerContext } from '../types'
import { GameErrors } from '../../modules/errors'
import type { IGameBoard } from '../../modules/GameManager'
import {
  GameCommandError,
  runGameCommand,
  type GameCommandGuard,
} from './gameCommand'

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

/** Ходы дракона доступны только тому, кому принадлежит очередь и ход дракона. */
const requireDragonTurn: GameCommandGuard = (game, socketId) =>
  game.dragonMove &&
  game.players[game.currentPlayerIndex]?.socketId === socketId
    ? undefined
    : GameErrors.InvalidDragonTurn

export function registerGameHandlers(context: SocketHandlerContext) {
  const { io, service, socket } = context

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
          maybeContinueWithComputerMove(io, service, game, gameId)
        },
      })
    }
  )

  socket.on(
    SocketEvents.PlaceFollower,
    async (
      {
        gameId,
        place,
        followerType = FollowerTypes.Follower,
      }: {
        gameId: string
        place: AvailableFollowerPlace
        followerType?: FollowerType
      },
      callback: SocketCallback
    ) => {
      await runGameCommand(context, {
        gameId,
        command: SocketEvents.PlaceFollower,
        callback,
        execute: async ({ game, save, ack }) => {
          if (game.princessChoice || game.dragonMove) {
            throw new Error(GameErrors.ResolveExpansionActionFirst)
          }

          const availablePlace = game.availableFollowersPlaces.find(
            (candidate) =>
              candidate.temporaryObject.id === place?.temporaryObject?.id &&
              candidate.point.x === place?.point?.x &&
              candidate.point.y === place?.point?.y &&
              candidate.point.direction === place?.point?.direction &&
              candidate.point.pointType === place?.point?.pointType
          )
          if (
            !availablePlace ||
            !Object.values(FollowerTypes).includes(followerType)
          ) {
            throw new Error(GameErrors.InvalidFollowerPlacement)
          }
          if (
            followerType === FollowerTypes.Abbot &&
            !(
              availablePlace.temporaryObject.isMonastery ||
              availablePlace.temporaryObject.isGarden
            )
          ) {
            throw new Error(GameErrors.AbbotRequiresMonasteryOrGarden)
          }
          if (
            followerType === FollowerTypes.BigFollower &&
            !game.rules.expansions.innsAndCathedrals
          ) {
            throw new Error(GameErrors.BigFollowerExpansionDisabled)
          }
          if (
            followerType === FollowerTypes.Follower &&
            availablePlace.temporaryObject.isGarden
          ) {
            throw new Error(GameErrors.FollowerNotAllowedOnGarden)
          }

          const followersBefore = game.placedFollowers.length
          game.placeFollower(availablePlace, followerType)
          if (game.placedFollowers.length !== followersBefore + 1) {
            throw new Error(GameErrors.FollowerPlacementUnavailable)
          }

          await save()
          ack()
          maybeContinueWithComputerMove(io, service, game, gameId)
        },
      })
    }
  )

  socket.on(
    SocketEvents.RecallAbbot,
    async ({ gameId }: { gameId: string }, callback: SocketCallback) => {
      await runGameCommand(context, {
        gameId,
        command: SocketEvents.RecallAbbot,
        callback,
        execute: async ({ game, save, ack }) => {
          if (!game.recallAbbot()) {
            throw new Error(GameErrors.NoAbbotOnBoard)
          }
          await save()
          ack()
          // Отзыв не расходует ход, но очередь могла уже перейти к компьютеру
          maybeContinueWithComputerMove(io, service, game, gameId)
        },
      })
    }
  )

  socket.on(
    SocketEvents.MoveDragon,
    async (
      {
        gameId,
        position,
      }: { gameId: string; position: { rowIndex: number; tileIndex: number } },
      callback: SocketCallback
    ) => {
      await runGameCommand(context, {
        gameId,
        command: SocketEvents.MoveDragon,
        callback,
        guard: requireDragonTurn,
        execute: async ({ game, save, ack }) => {
          if (
            !position ||
            !game.moveDragon(position.rowIndex, position.tileIndex)
          ) {
            throw new Error(GameErrors.InvalidDragonDestination)
          }
          await save()
          ack()
          maybeContinueWithComputerMove(io, service, game, gameId)
        },
      })
    }
  )

  socket.on(
    SocketEvents.ChoosePrincess,
    async (
      {
        gameId,
        cityId,
        point,
      }: { gameId: string; cityId: string; point: Point },
      callback: SocketCallback
    ) => {
      await runGameCommand(context, {
        gameId,
        command: SocketEvents.ChoosePrincess,
        callback,
        execute: async ({ game, save, ack }) => {
          if (!game.princessChoice) {
            throw new Error(GameErrors.PrincessChoiceNotPending)
          }
          if (
            typeof cityId !== 'string' ||
            !point ||
            !game.choosePrincessFollower(cityId, point)
          ) {
            throw new Error(GameErrors.InvalidPrincessCity)
          }
          await save()
          ack()
          maybeContinueWithComputerMove(io, service, game, gameId)
        },
      })
    }
  )

  socket.on(
    SocketEvents.SkipFollower,
    async ({ gameId }: { gameId: string }, callback: SocketCallback) => {
      await runGameCommand(context, {
        gameId,
        command: SocketEvents.SkipFollower,
        callback,
        execute: async ({ game, save, ack }) => {
          if (game.princessChoice || game.dragonMove) {
            throw new Error(GameErrors.ResolveExpansionActionFirst)
          }
          // Пропуск фишек допустим только на фазе выставления: иначе игрок
          // смог бы пропустить ход с уже выложенным тайлом и передать очередь.
          if (!game.isPlacingFollower) {
            throw new Error(GameErrors.NotPlacingFollower)
          }

          game.skipFollower()
          await save()
          ack()
          maybeContinueWithComputerMove(io, service, game, gameId)
        },
      })
    }
  )
}
