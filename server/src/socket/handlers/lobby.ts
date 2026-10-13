import {
  continueComputerGame,
  isComputerPlayer,
  scheduleComputerMove,
} from '../../services/computerPlayer'
import type { IGameBoard } from '../../modules/GameManager'
import type { SocketCallback, SocketHandlerContext } from '../types'
import { SocketEvents } from '../../modules/types'
import { CommonErrors, LobbyErrors } from '../../modules/errors'
import { getErrorMessage } from '../../utils/common'
import { ackGameUpdated, runLobbyCommand } from './shared'

function isComputerOnlyGame(game: IGameBoard): boolean {
  return game.players.length > 0 && game.players.every(isComputerPlayer)
}

/**
 * Команды жизненного цикла лобби: список партий, создание, вход, старт и
 * выход. Правка отдельных слотов живёт в `slots.ts`.
 */
export function registerLobbyHandlers(context: SocketHandlerContext) {
  const { events, service, socket } = context

  socket.on(SocketEvents.GetGamesList, async (callback: SocketCallback) => {
    await runLobbyCommand(callback, async () => {
      const games = await service.getGameSummaries()
      callback?.({ games })
    })
  })

  socket.on(
    SocketEvents.CreateGame,
    async (callbackOrPayload?: unknown, maybeCallback?: SocketCallback) => {
      await runLobbyCommand(maybeCallback, async () => {
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
          callback?.({ error: LobbyErrors.InvalidFinalScoringOption })
          return
        }
        if (
          payload?.innsAndCathedralsEnabled !== undefined &&
          typeof payload.innsAndCathedralsEnabled !== 'boolean'
        ) {
          callback?.({ error: LobbyErrors.InvalidInnsAndCathedralsOption })
          return
        }
        if (
          payload?.riverEnabled !== undefined &&
          typeof payload.riverEnabled !== 'boolean'
        ) {
          callback?.({ error: LobbyErrors.InvalidRiverOption })
          return
        }
        if (
          payload?.princessAndDragonEnabled !== undefined &&
          typeof payload.princessAndDragonEnabled !== 'boolean'
        ) {
          callback?.({ error: LobbyErrors.InvalidPrincessAndDragonOption })
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
            error: getErrorMessage(error),
          })
          return
        }
        await socket.join(game.id)
        socket.emit(SocketEvents.GameCreated, {
          gameId: game.id,
          game: service.formatGameData(game),
        })
        callback?.({
          success: true,
          gameId: game.id,
          game: service.formatGameData(game),
        })
        events.publishGamesList(service.formatGamesList())
      })
    }
  )

  socket.on(
    SocketEvents.JoinGame,
    async ({ gameId }: { gameId: string }, callback?: SocketCallback) => {
      await runLobbyCommand(callback, async () => {
        const existingGame = service.getGameByIdentifier(gameId)
        const resolvedGameId = existingGame?.id
        if (!existingGame || !resolvedGameId) {
          const error = CommonErrors.GameNotFound
          socket.emit(SocketEvents.Error, error)
          callback?.({ error })
          return
        }
        if (
          existingGame.gameIsEnded ||
          (existingGame.gameIsStarted && isComputerOnlyGame(existingGame))
        ) {
          await socket.join(resolvedGameId)
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

        await socket.join(resolvedGameId)
        try {
          await service.saveGame(resolvedGameId)
        } catch (error) {
          service.releasePlayerSlot(resolvedGameId, socket.id)
          await socket.leave(resolvedGameId)
          callback?.({
            error: getErrorMessage(error),
          })
          return
        }
        ackGameUpdated(events, service, resolvedGameId, result.game, callback)
      })
    }
  )

  socket.on(
    SocketEvents.StartGame,
    async ({ gameId }: { gameId: string }, callback?: SocketCallback) => {
      await runLobbyCommand(callback, async () => {
        const game = service.getGame(gameId)
        if (!game) {
          socket.emit(SocketEvents.Error, CommonErrors.GameNotFound)
          callback?.({ error: CommonErrors.GameNotFound })
          return
        }
        if (!service.canStartLobby(gameId, socket.id)) {
          socket.emit(SocketEvents.Error, LobbyErrors.OnlyLobbyOwnerCanStart)
          callback?.({ error: LobbyErrors.OnlyLobbyOwnerCanStart })
          return
        }

        const previousGame = game
        const newGame = service.startGame(gameId)
        if (!newGame) {
          callback?.({ error: LobbyErrors.StartFailed })
          return
        }

        try {
          await service.saveGame(gameId)
        } catch (error) {
          service.restoreGame(gameId, previousGame)
          callback?.({
            error: getErrorMessage(error),
          })
          return
        }

        ackGameUpdated(events, service, gameId, newGame, callback)

        if (newGame.players.every((p) => !p.socketId && !p.deviceId)) {
          scheduleComputerMove(events, service, gameId)
        }
      })
    }
  )

  socket.on(
    SocketEvents.LeaveGame,
    async ({ gameId }: { gameId: string }, callback?: SocketCallback) => {
      await runLobbyCommand(callback, async () => {
        const game = service.getGame(gameId)
        if (!game) {
          socket.emit(SocketEvents.Error, CommonErrors.GameNotFound)
          callback?.({ error: CommonErrors.GameNotFound })
          return
        }

        if (!game.gameIsStarted) {
          service.releasePlayerSlot(gameId, socket.id)
          if (game.players.every((p) => !p.socketId && !p.deviceId)) {
            try {
              await service.deleteGame(gameId)
            } catch (error) {
              callback?.({
                error: getErrorMessage(error),
              })
              return
            }
            events.publishGameDeleted(gameId)
            events.publishGamesList(service.formatGamesList())
          }
        } else if (!game.gameIsEnded) {
          service.clearPlayerSocket(gameId, socket.id)
          continueComputerGame(events, service, gameId)
        }

        await socket.leave(gameId)
        ackGameUpdated(events, service, gameId, game, callback)
      })
    }
  )
}
