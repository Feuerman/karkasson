import {
  continueComputerGame,
  isComputerPlayer,
  scheduleComputerMove,
} from '../../services/computerPlayer'
import type { IGameBoard } from '../../modules/GameManager'
import type { SocketCallback, SocketHandlerContext } from '../types'
import { SocketEvents } from '../../modules/types'

function isComputerOnlyGame(game: IGameBoard): boolean {
  return game.players.length > 0 && game.players.every(isComputerPlayer)
}

export function registerLobbyHandlers({
  io,
  service,
  socket,
}: SocketHandlerContext) {
  socket.on(SocketEvents.GetGamesList, async (callback: SocketCallback) => {
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
    SocketEvents.CreateGame,
    async (
      callbackOrPayload?: SocketCallback | unknown,
      maybeCallback?: SocketCallback
    ) => {
      const callback =
        typeof callbackOrPayload === 'function'
          ? callbackOrPayload
          : maybeCallback
      const payload =
        typeof callbackOrPayload === 'object' && callbackOrPayload !== null
          ? (callbackOrPayload as {
              finalScoringEnabled?: unknown
              innsAndCathedralsEnabled?: unknown
              riverEnabled?: unknown
              princessAndDragonEnabled?: unknown
            })
          : undefined
      if (
        payload?.finalScoringEnabled !== undefined &&
        typeof payload.finalScoringEnabled !== 'boolean'
      ) {
        callback?.({ error: 'Invalid final scoring option' })
        return
      }
      if (
        payload?.innsAndCathedralsEnabled !== undefined &&
        typeof payload.innsAndCathedralsEnabled !== 'boolean'
      ) {
        callback?.({ error: 'Invalid Inns and Cathedrals option' })
        return
      }
      if (
        payload?.riverEnabled !== undefined &&
        typeof payload.riverEnabled !== 'boolean'
      ) {
        callback?.({ error: 'Invalid River option' })
        return
      }
      if (
        payload?.princessAndDragonEnabled !== undefined &&
        typeof payload.princessAndDragonEnabled !== 'boolean'
      ) {
        callback?.({ error: 'Invalid Princess and Dragon option' })
        return
      }
      const game = service.createLobby(socket.id, {
        finalScoringEnabled: payload?.finalScoringEnabled === true,
        innsAndCathedralsEnabled: payload?.innsAndCathedralsEnabled === true,
        riverEnabled: payload?.riverEnabled === true,
        princessAndDragonEnabled: payload?.princessAndDragonEnabled === true,
      })
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
      socket.emit(SocketEvents.GameCreated, {
        gameId: game.id,
        game: service.formatGameData(game),
      })
      callback?.({
        success: true,
        gameId: game.id,
        game: service.formatGameData(game),
      })
      io.emit(SocketEvents.UpdateGamesList, service.formatGamesList())
    }
  )

  socket.on(
    SocketEvents.JoinGame,
    async ({ gameId }: { gameId: string }, callback?: SocketCallback) => {
      const existingGame = service.getGameByIdentifier(gameId)
      const resolvedGameId = existingGame?.id
      if (!existingGame || !resolvedGameId) {
        const error = 'Game not found'
        socket.emit(SocketEvents.Error, error)
        callback?.({ error })
        return
      }
      if (
        existingGame?.gameIsEnded ||
        (existingGame?.gameIsStarted && isComputerOnlyGame(existingGame))
      ) {
        socket.join(resolvedGameId)
        const game = service.formatGameData(existingGame)
        socket.emit(SocketEvents.GameUpdated, game)
        callback?.({ success: true, game })
        return
      }

      const deviceId = service.getDeviceBySocketId(socket.id)
      const result = service.joinFirstFreeSlot(
        resolvedGameId,
        socket.id,
        deviceId
      )

      if ('error' in result) {
        socket.emit(SocketEvents.Error, result.error)
        callback?.({ error: result.error })
        return
      }

      socket.join(resolvedGameId)
      try {
        await service.saveGame(resolvedGameId)
      } catch (error) {
        service.releasePlayerSlot(resolvedGameId, socket.id)
        socket.leave(resolvedGameId)
        callback?.({
          error: error instanceof Error ? error.message : String(error),
        })
        return
      }
      io.to(resolvedGameId).emit(
        SocketEvents.GameUpdated,
        service.formatGameData(result.game)
      )
      callback?.({ success: true, game: service.formatGameData(result.game) })
    }
  )

  socket.on(
    SocketEvents.AddPlayer,
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
      io.to(gameId).emit(
        SocketEvents.GameUpdated,
        service.formatGameData(currentGame)
      )
      callback?.({
        success: true,
        game: service.formatGameData(currentGame),
      })
    }
  )

  socket.on(
    SocketEvents.RemovePlayer,
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
      io.to(gameId).emit(
        SocketEvents.GameUpdated,
        service.formatGameData(currentGame)
      )
      callback?.({
        success: true,
        game: service.formatGameData(currentGame),
      })
    }
  )

  socket.on(
    SocketEvents.StartGame,
    async ({ gameId }: { gameId: string }, callback?: SocketCallback) => {
      const game = service.getGame(gameId)
      if (!game) {
        socket.emit(SocketEvents.Error, 'Game not found')
        callback?.({ error: 'Game not found' })
        return
      }
      if (!service.canStartLobby(gameId, socket.id)) {
        socket.emit(
          SocketEvents.Error,
          'Только создатель лобби может начать игру'
        )
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

      io.to(gameId).emit(
        SocketEvents.GameUpdated,
        service.formatGameData(newGame)
      )
      callback?.({ success: true, game: service.formatGameData(newGame) })

      if (game.players.every((p) => !p.socketId && !p.deviceId)) {
        scheduleComputerMove(io, service, gameId)
      }
    }
  )

  socket.on(
    SocketEvents.LeaveGame,
    async ({ gameId }: { gameId: string }, callback?: SocketCallback) => {
      const game = service.getGame(gameId)
      if (!game) {
        socket.emit(SocketEvents.Error, 'Game not found')
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
          io.to(gameId).emit(SocketEvents.GameDeleted)
          io.emit(SocketEvents.UpdateGamesList, service.formatGamesList())
        }
      } else if (!game.gameIsEnded) {
        service.clearPlayerSocket(gameId, socket.id)
        continueComputerGame(io, service, gameId)
      }

      socket.leave(gameId)
      io.to(gameId).emit(SocketEvents.GameUpdated, service.formatGameData(game))
      callback?.({ success: true, game: service.formatGameData(game) })
    }
  )
}
