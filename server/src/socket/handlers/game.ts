import type { IGameBoard } from '../../modules/GameManager'
import type {
  AvailableFollowerPlace,
  FollowerType,
  PlacementConflict,
  Point,
  Tile,
} from '../../modules/types'
import { describePlacementFailure } from '../../modules/gameGeometry'
import { rotateTileGroups, rotateTileSides } from '../../modules/tileRotation'
import tiles from '../../data/tiles'
import { innsAndCathedralsTiles } from '../../data/innsAndCathedralsTiles'
import { riverTiles } from '../../data/riverTiles'
import { princessAndDragonTiles } from '../../data/princessAndDragonTiles'
import { maybeContinueWithComputerMove } from '../../services/computerPlayer'
import {
  FollowerType as FollowerTypes,
  SocketEvents,
  TILE_ROTATIONS,
  TileRotation,
} from '../../modules/types'
import type { SocketCallback, SocketHandlerContext } from '../types'
import { CommonErrors, GameErrors } from '../../modules/errors'

function playerIndexesForSocket(game: IGameBoard, socketId: string): number[] {
  return game.players.reduce<number[]>((acc, player, index) => {
    if (player.socketId === socketId) acc.push(index)
    return acc
  }, [])
}

function isPlayersTurn(game: IGameBoard, socketId: string): boolean {
  return playerIndexesForSocket(game, socketId).some(
    (index) => index === game.currentPlayerIndex
  )
}

function isValidPosition(position: { rowIndex: number; tileIndex: number }) {
  return (
    Number.isInteger(position.rowIndex) && Number.isInteger(position.tileIndex)
  )
}

/** Отказ разместить тайл с причиной (стороны или правила реки). */
class TilePlacementError extends Error {
  readonly conflicts: PlacementConflict[]

  constructor(conflicts: PlacementConflict[]) {
    super(describePlacementFailure(conflicts))
    this.name = 'TilePlacementError'
    this.conflicts = conflicts
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

  const definition =
    (game.rules.expansions.princessAndDragon
      ? princessAndDragonTiles.find((tile) => tile.id === currentTile.id)
      : undefined) ??
    tiles.find((tile) => tile.id === currentTile.id) ??
    (game.rules.expansions.innsAndCathedrals
      ? innsAndCathedralsTiles.find((tile) => tile.id === currentTile.id)
      : undefined) ??
    (game.rules.expansions.river
      ? riverTiles.find((tile) => tile.id === currentTile.id)
      : undefined)
  if (!definition) return false

  const quarterTurns = rotation / TileRotation.QuarterTurn
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

export function registerGameHandlers({
  io,
  service,
  socket,
}: SocketHandlerContext) {
  socket.on(
    SocketEvents.SelectPlacingPoint,
    (
      {
        gameId,
        point,
      }: { gameId: string; point: { rowIndex: number; tileIndex: number } },
      callback: SocketCallback
    ) => {
      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: CommonErrors.GameNotFound })
        return
      }
      if (!isPlayersTurn(game, socket.id)) {
        callback?.({ error: GameErrors.NotPlayersTurn })
        return
      }

      game.placingPoint = {
        rowIndex: point.rowIndex,
        tileIndex: point.tileIndex,
      }
      io.to(gameId).emit(SocketEvents.GameUpdated, service.formatGameData(game))
      callback?.({ success: true, game: service.formatGameData(game) })
    }
  )

  socket.on(
    SocketEvents.UpdateCurrentTile,
    (
      {
        gameId,
        rotation,
        tile,
      }: { gameId: string; rotation?: number; tile?: Pick<Tile, 'rotation'> },
      callback: SocketCallback
    ) => {
      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: CommonErrors.GameNotFound })
        return
      }
      if (!isPlayersTurn(game, socket.id)) {
        callback?.({ error: GameErrors.NotPlayersTurn })
        return
      }

      const requestedRotation = rotation ?? tile?.rotation
      if (
        game.isPlacingFollower ||
        game.princessChoice ||
        game.dragonMove ||
        typeof requestedRotation !== 'number' ||
        !setCurrentTileRotation(game, requestedRotation)
      ) {
        callback?.({ error: GameErrors.InvalidTileRotation })
        return
      }
      io.to(gameId).emit(SocketEvents.GameUpdated, service.formatGameData(game))
      callback?.({ success: true, game: service.formatGameData(game) })
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
      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: CommonErrors.GameNotFound })
        return
      }
      if (!isPlayersTurn(game, socket.id)) {
        callback?.({ error: GameErrors.NotPlayersTurn })
        return
      }
      if (
        game.isPlacingFollower ||
        game.princessChoice ||
        game.dragonMove ||
        !game.currentTile
      ) {
        callback?.({ error: 'No tile is waiting to be placed' })
        return
      }
      if (!isValidPosition(position)) {
        callback?.({ error: 'Invalid tile position' })
        return
      }

      const previousState = game.clone()
      try {
        if (rotation !== undefined && !setCurrentTileRotation(game, rotation)) {
          callback?.({ error: GameErrors.InvalidTileRotation })
          return
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

        try {
          await service.saveGame(gameId)
        } catch (error) {
          game.copyStateFrom(previousState)
          throw error
        }

        io.to(gameId).emit(
          SocketEvents.GameUpdated,
          service.formatGameData(game)
        )
        callback?.({ success: true, game: service.formatGameData(game) })

        maybeContinueWithComputerMove(io, service, game, gameId)
      } catch (error) {
        console.error('Error placing tile:', error)
        if (error instanceof TilePlacementError) {
          callback?.({
            error: error.message,
            ...(error.conflicts.length ? { conflicts: error.conflicts } : {}),
          })
          return
        }
        callback?.({
          error: error instanceof Error ? error.message : String(error),
        })
      }
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
      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: CommonErrors.GameNotFound })
        return
      }
      if (!isPlayersTurn(game, socket.id)) {
        callback?.({ error: GameErrors.NotPlayersTurn })
        return
      }
      if (game.princessChoice || game.dragonMove) {
        callback?.({ error: GameErrors.ResolveExpansionActionFirst })
        return
      }

      const previousState = game.clone()
      try {
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
          throw new Error('Invalid follower placement')
        }
        if (
          followerType === FollowerTypes.Abbot &&
          !(
            availablePlace.temporaryObject.isMonastery ||
            availablePlace.temporaryObject.isGarden
          )
        ) {
          throw new Error(
            'An abbot can only be placed on a monastery or garden'
          )
        }
        if (
          followerType === FollowerTypes.BigFollower &&
          !game.rules.expansions.innsAndCathedrals
        ) {
          throw new Error('The big follower expansion is not enabled')
        }
        if (
          followerType === FollowerTypes.Follower &&
          availablePlace.temporaryObject.isGarden
        ) {
          throw new Error('A follower cannot be placed on a garden')
        }

        const followersBefore = game.placedFollowers.length
        game.placeFollower(availablePlace, followerType)
        if (game.placedFollowers.length !== followersBefore + 1) {
          throw new Error('Follower placement is no longer available')
        }
        try {
          await service.saveGame(gameId)
        } catch (error) {
          game.copyStateFrom(previousState)
          throw error
        }

        io.to(gameId).emit(
          SocketEvents.GameUpdated,
          service.formatGameData(game)
        )
        callback?.({ success: true, game: service.formatGameData(game) })

        maybeContinueWithComputerMove(io, service, game, gameId)
      } catch (error) {
        console.error('Error placing follower:', error)
        callback?.({
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  )

  socket.on(
    SocketEvents.RecallAbbot,
    async ({ gameId }: { gameId: string }, callback: SocketCallback) => {
      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: CommonErrors.GameNotFound })
        return
      }
      if (!isPlayersTurn(game, socket.id)) {
        callback?.({ error: GameErrors.NotPlayersTurn })
        return
      }

      const previousState = game.clone()
      try {
        if (!game.recallAbbot()) {
          throw new Error('У игрока нет аббата на доске')
        }
        try {
          await service.saveGame(gameId)
        } catch (error) {
          game.copyStateFrom(previousState)
          throw error
        }

        io.to(gameId).emit(
          SocketEvents.GameUpdated,
          service.formatGameData(game)
        )
        callback?.({ success: true, game: service.formatGameData(game) })

        // Отзыв не расходует ход, но очередь могла уже перейти к компьютеру
        maybeContinueWithComputerMove(io, service, game, gameId)
      } catch (error) {
        console.error('Error recalling abbot:', error)
        callback?.({
          error: error instanceof Error ? error.message : String(error),
        })
      }
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
      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: CommonErrors.GameNotFound })
        return
      }
      if (
        !game.dragonMove ||
        game.players[game.currentPlayerIndex]?.socketId !== socket.id
      ) {
        callback?.({ error: 'Invalid dragon move turn' })
        return
      }
      const previousState = game.clone()
      try {
        if (
          !position ||
          !game.moveDragon(position.rowIndex, position.tileIndex)
        ) {
          throw new Error('Invalid dragon destination')
        }
        try {
          await service.saveGame(gameId)
        } catch (error) {
          game.copyStateFrom(previousState)
          throw error
        }
        io.to(gameId).emit(
          SocketEvents.GameUpdated,
          service.formatGameData(game)
        )
        callback?.({ success: true, game: service.formatGameData(game) })
        maybeContinueWithComputerMove(io, service, game, gameId)
      } catch (error) {
        game.copyStateFrom(previousState)
        callback?.({
          error: error instanceof Error ? error.message : String(error),
        })
      }
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
      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: CommonErrors.GameNotFound })
        return
      }
      if (!isPlayersTurn(game, socket.id)) {
        callback?.({ error: GameErrors.NotPlayersTurn })
        return
      }
      if (!game.princessChoice) {
        callback?.({ error: 'Princess choice is not pending' })
        return
      }
      const previousState = game.clone()
      try {
        if (
          typeof cityId !== 'string' ||
          !point ||
          !game.choosePrincessFollower(cityId, point)
        ) {
          throw new Error('Invalid princess city')
        }
        await service.saveGame(gameId)
        io.to(gameId).emit(
          SocketEvents.GameUpdated,
          service.formatGameData(game)
        )
        callback?.({ success: true, game: service.formatGameData(game) })
        maybeContinueWithComputerMove(io, service, game, gameId)
      } catch (error) {
        game.copyStateFrom(previousState)
        callback?.({
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  )

  socket.on(
    SocketEvents.SkipFollower,
    async ({ gameId }: { gameId: string }, callback: SocketCallback) => {
      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: CommonErrors.GameNotFound })
        return
      }
      if (!isPlayersTurn(game, socket.id)) {
        callback?.({ error: GameErrors.NotPlayersTurn })
        return
      }
      if (game.princessChoice || game.dragonMove) {
        callback?.({ error: GameErrors.ResolveExpansionActionFirst })
        return
      }

      const previousState = game.clone()
      try {
        game.skipFollower()
        try {
          await service.saveGame(gameId)
        } catch (error) {
          game.copyStateFrom(previousState)
          throw error
        }

        io.to(gameId).emit(
          SocketEvents.GameUpdated,
          service.formatGameData(game)
        )
        callback?.({ success: true, game: service.formatGameData(game) })

        maybeContinueWithComputerMove(io, service, game, gameId)
      } catch (error) {
        console.error('Error skipping follower:', error)
        callback?.({
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  )
}
