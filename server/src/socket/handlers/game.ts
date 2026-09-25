import type { IGameBoard } from '../../modules/GameManager'
import type {
  AvailableFollowerPlace,
  FollowerType,
  Tile,
} from '../../modules/types'
import tiles from '../../data/tiles'
import { maybeContinueWithComputerMove } from '../../services/computerPlayer'
import type { SocketCallback, SocketHandlerContext } from '../types'

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

function setCurrentTileRotation(game: IGameBoard, rotation: number): boolean {
  const currentTile = game.currentTile
  if (!currentTile || ![0, 90, 180, 270].includes(rotation)) return false

  const definition = tiles.find((tile) => tile.id === currentTile.id)
  if (!definition) return false

  let sides = { ...definition.sides }
  for (let turn = 0; turn < rotation / 90; turn++) {
    sides = {
      north: sides.west,
      east: sides.north,
      south: sides.east,
      west: sides.south,
    }
  }

  const rotatedTile: Tile = {
    ...currentTile,
    ...definition,
    rotation,
    sides,
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
    'selectPlacingPoint',
    (
      {
        gameId,
        point,
      }: { gameId: string; point: { rowIndex: number; tileIndex: number } },
      callback: SocketCallback
    ) => {
      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: 'Game not found' })
        return
      }
      if (!isPlayersTurn(game, socket.id)) {
        callback?.({ error: "Not player's turn" })
        return
      }

      game.placingPoint = {
        rowIndex: point.rowIndex,
        tileIndex: point.tileIndex,
      }
      io.to(gameId).emit('gameUpdated', service.formatGameData(game))
      callback?.({ success: true, game })
    }
  )

  socket.on(
    'updateCurrentTile',
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
        callback?.({ error: 'Game not found' })
        return
      }
      if (!isPlayersTurn(game, socket.id)) {
        callback?.({ error: "Not player's turn" })
        return
      }

      const requestedRotation = rotation ?? tile?.rotation
      if (
        game.isPlacingFollower ||
        typeof requestedRotation !== 'number' ||
        !setCurrentTileRotation(game, requestedRotation)
      ) {
        callback?.({ error: 'Invalid tile rotation' })
        return
      }
      io.to(gameId).emit('gameUpdated', service.formatGameData(game))
      callback?.({ success: true, game })
    }
  )

  socket.on(
    'placeTile',
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
        callback?.({ error: 'Game not found' })
        return
      }
      if (!isPlayersTurn(game, socket.id)) {
        callback?.({ error: "Not player's turn" })
        return
      }
      if (game.isPlacingFollower || !game.currentTile) {
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
          callback?.({ error: 'Invalid tile rotation' })
          return
        }
        const isValidMove = game.placeTile(
          game.currentTile,
          position.rowIndex,
          position.tileIndex
        )
        if (!isValidMove) {
          throw new Error('Невозможно разместить тайл на данной позиции')
        }

        try {
          await service.saveGame(gameId)
        } catch (error) {
          game.copyStateFrom(previousState)
          throw error
        }

        io.to(gameId).emit('gameUpdated', service.formatGameData(game))
        callback?.({ success: true, game })

        maybeContinueWithComputerMove(io, service, game, gameId)
      } catch (error) {
        console.error('Error placing tile:', error)
        callback?.({
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  )

  socket.on(
    'placeFollower',
    async (
      {
        gameId,
        place,
        followerType = 'follower',
      }: {
        gameId: string
        place: AvailableFollowerPlace
        followerType?: FollowerType
      },
      callback: SocketCallback
    ) => {
      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: 'Game not found' })
        return
      }
      if (!isPlayersTurn(game, socket.id)) {
        callback?.({ error: "Not player's turn" })
        return
      }

      const previousState = game.clone()
      try {
        const availablePlace = game.availableFollowersPlaces.find(
          (candidate) =>
            candidate.temporaryObject.id === place?.temporaryObject?.id &&
            candidate.point.x === place?.point?.x &&
            candidate.point.y === place?.point?.y &&
            candidate.point.direction === place?.point?.direction
        )
        if (!availablePlace || !['follower', 'abbot'].includes(followerType)) {
          throw new Error('Invalid follower placement')
        }
        if (
          followerType === 'abbot' &&
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
          followerType === 'follower' &&
          availablePlace.temporaryObject.isGarden
        ) {
          throw new Error('A follower cannot be placed on a garden')
        }

        game.placeFollower(availablePlace, followerType)
        try {
          await service.saveGame(gameId)
        } catch (error) {
          game.copyStateFrom(previousState)
          throw error
        }

        io.to(gameId).emit('gameUpdated', service.formatGameData(game))
        callback?.({ success: true, game })

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
    'recallAbbot',
    async ({ gameId }: { gameId: string }, callback: SocketCallback) => {
      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: 'Game not found' })
        return
      }
      if (!isPlayersTurn(game, socket.id)) {
        callback?.({ error: "Not player's turn" })
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

        io.to(gameId).emit('gameUpdated', service.formatGameData(game))
        callback?.({ success: true, game })

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
    'checkAvailablePlacements',
    (
      {
        gameId,
        position,
      }: { gameId: string; position: { row: number; col: number } },
      callback: SocketCallback
    ) => {
      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: 'Game not found' })
        return
      }

      const { row, col } = position
      const tile = game.tilePlacesStats[row]?.[col]
      if (!tile) {
        callback?.({ error: 'Tile not found' })
        return
      }

      const availablePlacements: {
        type: 'road' | 'city' | 'monastery' | 'garden'
        side?: string
      }[] = []

      Object.entries(tile.sides).forEach(([side, type]) => {
        if (type === 'road') {
          const road = game.temporaryObjects.roads.find((r) =>
            r.points.some(
              (p) => p.x === col && p.y === row && p.direction === side
            )
          )
          if (road && road.followers.length === 0) {
            availablePlacements.push({ type: 'road', side })
          }
        } else if (type === 'city') {
          const city = game.temporaryObjects.cities.find((c) =>
            c.points.some(
              (p) => p.x === col && p.y === row && p.direction === side
            )
          )
          if (city && city.followers.length === 0) {
            availablePlacements.push({ type: 'city', side })
          }
        }
      })

      if (tile.isMonastery) {
        const monastery = game.temporaryObjects.monasteries.find(
          (m) => m.points[0]?.x === col && m.points[0]?.y === row
        )
        if (monastery && monastery.followers.length === 0) {
          availablePlacements.push({ type: 'monastery', side: 'center' })
        }
      }

      if (tile.hasGarden) {
        const garden = game.temporaryObjects.gardens.find(
          (g) => g.points[0]?.x === col && g.points[0]?.y === row
        )
        if (garden && garden.followers.length === 0) {
          availablePlacements.push({ type: 'garden', side: 'center' })
        }
      }

      callback?.({ placements: availablePlacements })
    }
  )

  socket.on(
    'skipFollower',
    async ({ gameId }: { gameId: string }, callback: SocketCallback) => {
      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: 'Game not found' })
        return
      }
      if (!isPlayersTurn(game, socket.id)) {
        callback?.({ error: "Not player's turn" })
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

        io.to(gameId).emit('gameUpdated', service.formatGameData(game))
        callback?.({ success: true, game })

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
