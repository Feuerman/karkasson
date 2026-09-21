import type { SocketHandlerContext } from '../types'
import { runComputerMoves } from '../../services/computerPlayer'

function isTemporaryDisconnect(reason: string): boolean {
  return reason === 'transport close' || reason === 'ping timeout'
}

export function registerConnectionHandlers({
  io,
  service,
  socket,
}: SocketHandlerContext) {
  socket.on('registerDevice', ({ deviceId }: { deviceId: string }) => {
    service.registerDevice(deviceId, socket.id)
  })

  socket.on('disconnect', (reason: string) => {
    const deviceId = service.getDeviceBySocketId(socket.id)
    const [game] = service.findPlayerGamesForSocket(socket.id)
    if (!game?.id) return
    const gameId = game.id

    if (isTemporaryDisconnect(reason)) {
      const playerIds = game.players.filter((p) => p.socketId === socket.id)
      socket
        .to(gameId)
        .emit('playerTemporaryDisconnected', { deviceId, playerIds })

      if (game.gameIsStarted) {
        service.releasePlayerToDevice(gameId, socket.id, deviceId)
        void service.saveGame(gameId)
      } else {
        service.releasePlayerSlot(gameId, socket.id)
      }

      io.to(gameId).emit('gameUpdated', service.formatGameData(game))
      return
    }

    if (game.gameIsStarted) {
      service.clearPlayerSocket(gameId, socket.id)
      io.to(gameId).emit('gameUpdated', service.formatGameData(game))
      return
    }

    if (service.hasOtherConnectedPlayers(game, socket.id)) {
      service.releasePlayerSlot(gameId, socket.id)
      io.to(gameId).emit('gameUpdated', service.formatGameData(game))
    } else {
      service.deleteGame(gameId)
      io.to(gameId).emit('gameDeleted')
      io.emit('updateGamesList', service.formatGamesList())
    }
  })

  socket.on(
    'rejoinGame',
    ({ gameId, deviceId }: { gameId: string; deviceId: string }) => {
      const result = service.rejoinGame(gameId, deviceId, socket.id)
      if (!result) {
        socket.emit('error', 'Game not found')
        return
      }

      const { game, players } = result
      if (players.length > 0) {
        socket.join(gameId)
        io.to(gameId).emit('gameUpdated', service.formatGameData(game))
      } else {
        socket.emit('error', 'Player not found in game')
      }

      if (game.gameIsStarted) {
        const allPlayersConnected = game.players.every(
          (p) => p.socketId !== null || !p.deviceId
        )
        const isComputerMove =
          !game.currentPlayer?.socketId && !game.currentPlayer?.deviceId

        if (allPlayersConnected && isComputerMove) {
          void runComputerMoves(io, service, gameId)
        }
      }
    }
  )
}
