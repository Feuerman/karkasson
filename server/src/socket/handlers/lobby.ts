import { isComputerPlayer } from '../../services/computerPlayer'
import type { GameManager } from '../../modules/GameManager'
import type { GameOptions } from '../../modules/types'
import type { SocketCallback, SocketHandlerContext } from '../types'
import { SocketEvents } from '../../modules/types'
import { CommonErrors, LobbyErrors } from '../../modules/errors'
import { ackGameUpdated, runLobbyCommand } from './shared'
import { formatGameData } from '../../services/gameView'

function isComputerOnlyGame(game: GameManager): boolean {
  return game.players.length > 0 && game.players.every(isComputerPlayer)
}

/** Опции лобби и текст ошибки для каждой из них. */
const LOBBY_OPTION_ERRORS: Record<keyof GameOptions, string> = {
  finalScoringEnabled: LobbyErrors.InvalidFinalScoringOption,
  innsAndCathedralsEnabled: LobbyErrors.InvalidInnsAndCathedralsOption,
  riverEnabled: LobbyErrors.InvalidRiverOption,
  princessAndDragonEnabled: LobbyErrors.InvalidPrincessAndDragonOption,
}

interface LobbyOptionsPayload {
  [option: string]: unknown
}

/**
 * Команды жизненного цикла лобби: список партий, создание, вход, старт и
 * выход. Правка отдельных слотов живёт в `slots.ts`.
 */
export function registerLobbyHandlers(context: SocketHandlerContext) {
  const { events, service, scheduler, socket } = context

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
            ? (callbackOrPayload as LobbyOptionsPayload)
            : undefined
        for (const [option, error] of Object.entries(LOBBY_OPTION_ERRORS)) {
          const value = payload?.[option]
          if (value !== undefined && typeof value !== 'boolean') {
            callback?.({ error })
            return
          }
        }
        const game = service.createLobby(socket.id, {
          finalScoringEnabled: payload?.finalScoringEnabled === true,
          innsAndCathedralsEnabled: payload?.innsAndCathedralsEnabled === true,
          riverEnabled: payload?.riverEnabled === true,
          princessAndDragonEnabled: payload?.princessAndDragonEnabled === true,
        })
        try {
          await service.saveWithRollback(game.id, () =>
            service.deleteGame(game.id)
          )
        } catch (error) {
          callback?.({
            error: CommonErrors.SaveFailed,
          })
          return
        }
        await socket.join(game.id)
        socket.emit(SocketEvents.GameCreated, {
          gameId: game.id,
          game: formatGameData(game),
        })
        callback?.({
          success: true,
          gameId: game.id,
          game: formatGameData(game),
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
          const game = formatGameData(existingGame)
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
          await service.saveWithRollback(resolvedGameId, () => {
            service.releasePlayer(resolvedGameId, socket.id, null)
          })
        } catch (error) {
          await socket.leave(resolvedGameId)
          callback?.({
            error: CommonErrors.SaveFailed,
          })
          return
        }
        ackGameUpdated(events, resolvedGameId, result.game, callback)
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
          await service.saveWithRollback(gameId, () => {
            service.restoreGame(gameId, previousGame)
          })
        } catch (error) {
          callback?.({
            error: CommonErrors.SaveFailed,
          })
          return
        }

        ackGameUpdated(events, gameId, newGame, callback)

        if (newGame.players.every((p) => !p.socketId && !p.deviceId)) {
          scheduler.scheduleMove(events, service, gameId)
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
          service.releasePlayer(gameId, socket.id, null)
          if (game.players.every((p) => !p.socketId && !p.deviceId)) {
            try {
              await service.deleteGame(gameId)
            } catch (error) {
              callback?.({
                error: CommonErrors.SaveFailed,
              })
              return
            }
            events.publishGameDeleted(gameId)
            events.publishGamesList(service.formatGamesList())
          }
        } else if (!game.gameIsEnded) {
          service.releasePlayer(gameId, socket.id)
          scheduler.continueGame(events, service, gameId)
        }

        await socket.leave(gameId)
        ackGameUpdated(events, gameId, game, callback)
      })
    }
  )
}
