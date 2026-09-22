import type { IGameBoard } from '../../modules/GameManager'
import type {
  AvailableFollowerPlace,
  GridTile,
  Tile,
} from '../../modules/types'
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
      { gameId, tile }: { gameId: string; tile: Tile },
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

      // Координаты появятся при размещении тайла (placeTile)
      game.currentTile = tile as GridTile
      io.to(gameId).emit('gameUpdated', service.formatGameData(game))
      callback?.({ success: true, game })
    }
  )

  socket.on(
    'placeTile',
    (
      {
        gameId,
        tile,
        position,
      }: {
        gameId: string
        tile: Tile
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

      try {
        void service.saveGame(gameId)

        const isValidMove = game.placeTile(
          tile,
          position.rowIndex,
          position.tileIndex
        )
        if (!isValidMove) {
          throw new Error('Невозможно разместить тайл на данной позиции')
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
    (
      { gameId, place }: { gameId: string; place: AvailableFollowerPlace },
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

      try {
        void service.saveGame(gameId)

        game.placeFollower(place)

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
        type: 'road' | 'city' | 'monastery'
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

      callback?.({ placements: availablePlacements })
    }
  )

  socket.on(
    'skipFollower',
    ({ gameId }: { gameId: string }, callback: SocketCallback) => {
      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: 'Game not found' })
        return
      }
      if (!isPlayersTurn(game, socket.id)) {
        callback?.({ error: "Not player's turn" })
        return
      }

      try {
        void service.saveGame(gameId)

        game.skipFollower()

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
