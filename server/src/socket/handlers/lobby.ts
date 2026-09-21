import { scheduleComputerMove } from '../../services/computerPlayer'
import type { SocketCallback, SocketHandlerContext } from '../types'

export function registerLobbyHandlers({
  io,
  service,
  socket,
}: SocketHandlerContext) {
  socket.on('getGamesList', async (callback: SocketCallback) => {
    const games = await service.getGameSummaries()
    callback?.({ games })
  })

  socket.on('createGame', () => {
    const game = service.createLobby(socket.id)
    socket.join(game.id)
    socket.emit('gameCreated', { gameId: game.id, game })
    io.emit('updateGamesList', service.formatGamesList())
  })

  socket.on('joinGame', ({ gameId }: { gameId: string }) => {
    const deviceId = service.getDeviceBySocketId(socket.id)
    const result = service.joinFirstFreeSlot(gameId, socket.id, deviceId)

    if ('error' in result) {
      socket.emit('error', result.error)
      return
    }

    socket.join(gameId)
    io.to(gameId).emit('gameUpdated', service.formatGameData(result.game))
  })

  socket.on(
    'addPlayer',
    (
      {
        gameId,
        name,
        index,
      }: { gameId: string; name: string | null; index: number },
      callback: SocketCallback
    ) => {
      const deviceId = service.getDeviceBySocketId(socket.id)
      service.addPlayer(gameId, index, {
        name,
        socketId: socket.id,
        deviceId,
      })

      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: 'Game not found' })
        return
      }
      io.to(gameId).emit('gameUpdated', service.formatGameData(game))
      callback?.({ success: true, game })
    }
  )

  socket.on(
    'removePlayer',
    (
      {
        gameId,
        index,
        name,
      }: { gameId: string; index: number; name: string | null },
      callback: SocketCallback
    ) => {
      service.removePlayer(gameId, index, name)

      const game = service.getGame(gameId)
      if (!game) {
        callback?.({ error: 'Game not found' })
        return
      }
      io.to(gameId).emit('gameUpdated', service.formatGameData(game))
      callback?.({ success: true, game })
    }
  )

  socket.on('startGame', ({ gameId }: { gameId: string }) => {
    const game = service.getGame(gameId)
    if (!game) {
      socket.emit('error', 'Game not found')
      return
    }

    const newGame = service.startGame(gameId)
    if (!newGame) return

    io.to(gameId).emit('gameUpdated', service.formatGameData(newGame))

    if (game.players.every((p) => !p.socketId && !p.deviceId)) {
      scheduleComputerMove(io, service, gameId)
    }
  })

  socket.on('leaveGame', ({ gameId }: { gameId: string }) => {
    const game = service.getGame(gameId)
    if (!game) {
      socket.emit('error', 'Game not found')
      return
    }

    if (!game.gameIsStarted) {
      service.releasePlayerSlot(gameId, socket.id)
      if (game.players.every((p) => !p.socketId && !p.deviceId)) {
        service.deleteGame(gameId)
        io.to(gameId).emit('gameDeleted')
        io.emit('updateGamesList', service.formatGamesList())
      }
    } else if (!game.gameIsEnded) {
      service.clearPlayerSocket(gameId, socket.id)
    }

    socket.leave(gameId)
    io.to(gameId).emit('gameUpdated', service.formatGameData(game))
  })
}
