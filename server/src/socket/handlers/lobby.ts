import { scheduleComputerMove } from '../../services/computerPlayer'
import type { SocketCallback, SocketHandlerContext } from '../types'

export function registerLobbyHandlers({
  io,
  service,
  socket,
}: SocketHandlerContext) {
  socket.on('getGamesList', async (callback: SocketCallback) => {
    try {
      const games = await service.getGameSummaries()
      callback?.({ games })
    } catch (error) {
      callback?.({
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })

  socket.on(
    'createGame',
    async (
      callbackOrPayload?: SocketCallback | unknown,
      maybeCallback?: SocketCallback
    ) => {
      const callback =
        typeof callbackOrPayload === 'function'
          ? callbackOrPayload
          : maybeCallback
      const game = service.createLobby(socket.id)
      try {
        await service.saveGame(game.id)
      } catch (error) {
        await service.deleteGame(game.id)
        callback?.({
          error: error instanceof Error ? error.message : String(error),
        })
        return
      }
      socket.join(game.id)
      socket.emit('gameCreated', { gameId: game.id, game })
      callback?.({
        success: true,
        gameId: game.id,
        game: service.formatGameData(game),
      })
      io.emit('updateGamesList', service.formatGamesList())
    }
  )

  socket.on(
    'joinGame',
    async ({ gameId }: { gameId: string }, callback?: SocketCallback) => {
      const deviceId = service.getDeviceBySocketId(socket.id)
      const result = service.joinFirstFreeSlot(gameId, socket.id, deviceId)

      if ('error' in result) {
        socket.emit('error', result.error)
        callback?.({ error: result.error })
        return
      }

      socket.join(gameId)
      try {
        await service.saveGame(gameId)
      } catch (error) {
        service.releasePlayerSlot(gameId, socket.id)
        socket.leave(gameId)
        callback?.({
          error: error instanceof Error ? error.message : String(error),
        })
        return
      }
      io.to(gameId).emit('gameUpdated', service.formatGameData(result.game))
      callback?.({ success: true, game: service.formatGameData(result.game) })
    }
  )

  socket.on(
    'addPlayer',
    async (
      {
        gameId,
        name,
        index,
      }: { gameId: string; name: string | null; index: number },
      callback: SocketCallback
    ) => {
      const deviceId = service.getDeviceBySocketId(socket.id)
      if (!service.canEditLobbySlot(gameId, socket.id, index)) {
        callback?.({ error: 'Недостаточно прав для изменения этого слота' })
        return
      }
      const currentGame = service.getGame(gameId)
      if (!currentGame) {
        callback?.({ error: 'Game not found' })
        return
      }
      const previousPlayers = JSON.parse(
        JSON.stringify(currentGame.players)
      ) as typeof currentGame.players
      service.addPlayer(gameId, index, {
        name,
        socketId: socket.id,
        deviceId,
      })

      try {
        await service.saveGame(gameId)
      } catch (error) {
        currentGame.players = previousPlayers
        callback?.({
          error: error instanceof Error ? error.message : String(error),
        })
        return
      }
      io.to(gameId).emit('gameUpdated', service.formatGameData(currentGame))
      callback?.({ success: true, game: currentGame })
    }
  )

  socket.on(
    'removePlayer',
    async (
      {
        gameId,
        index,
        name,
      }: { gameId: string; index: number; name: string | null },
      callback: SocketCallback
    ) => {
      const currentGame = service.getGame(gameId)
      if (!currentGame || !service.canEditLobbySlot(gameId, socket.id, index)) {
        callback?.({ error: 'Недостаточно прав для изменения этого слота' })
        return
      }
      const previousPlayers = JSON.parse(
        JSON.stringify(currentGame.players)
      ) as typeof currentGame.players
      service.removePlayer(gameId, index, name)

      try {
        await service.saveGame(gameId)
      } catch (error) {
        currentGame.players = previousPlayers
        callback?.({
          error: error instanceof Error ? error.message : String(error),
        })
        return
      }
      io.to(gameId).emit('gameUpdated', service.formatGameData(currentGame))
      callback?.({ success: true, game: currentGame })
    }
  )

  socket.on(
    'startGame',
    async ({ gameId }: { gameId: string }, callback?: SocketCallback) => {
      const game = service.getGame(gameId)
      if (!game) {
        socket.emit('error', 'Game not found')
        callback?.({ error: 'Game not found' })
        return
      }
      if (!service.canStartLobby(gameId, socket.id)) {
        socket.emit('error', 'Только создатель лобби может начать игру')
        callback?.({ error: 'Только создатель лобби может начать игру' })
        return
      }

      const previousGame = game
      const newGame = service.startGame(gameId)
      if (!newGame) {
        callback?.({ error: 'Не удалось начать игру' })
        return
      }

      try {
        await service.saveGame(gameId)
      } catch (error) {
        service.restoreGame(gameId, previousGame)
        callback?.({
          error: error instanceof Error ? error.message : String(error),
        })
        return
      }

      io.to(gameId).emit('gameUpdated', service.formatGameData(newGame))
      callback?.({ success: true, game: service.formatGameData(newGame) })

      if (game.players.every((p) => !p.socketId && !p.deviceId)) {
        scheduleComputerMove(io, service, gameId)
      }
    }
  )

  socket.on(
    'leaveGame',
    async ({ gameId }: { gameId: string }, callback?: SocketCallback) => {
      const game = service.getGame(gameId)
      if (!game) {
        socket.emit('error', 'Game not found')
        callback?.({ error: 'Game not found' })
        return
      }

      if (!game.gameIsStarted) {
        service.releasePlayerSlot(gameId, socket.id)
        if (game.players.every((p) => !p.socketId && !p.deviceId)) {
          try {
            await service.deleteGame(gameId)
          } catch (error) {
            callback?.({
              error: error instanceof Error ? error.message : String(error),
            })
            return
          }
          io.to(gameId).emit('gameDeleted')
          io.emit('updateGamesList', service.formatGamesList())
        }
      } else if (!game.gameIsEnded) {
        service.clearPlayerSocket(gameId, socket.id)
      }

      socket.leave(gameId)
      io.to(gameId).emit('gameUpdated', service.formatGameData(game))
      callback?.({ success: true, game: service.formatGameData(game) })
    }
  )
}
