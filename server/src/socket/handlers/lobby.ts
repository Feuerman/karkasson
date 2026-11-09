import { isComputerPlayer } from '../../services/computerPlayer'
import type { GameManager } from '../../modules/GameManager'
import type { GameOptions } from '../../modules/types'
import type { SocketHandlerContext } from '../types'
import { SocketEvents } from '../../modules/types'
import { CommonErrors, LobbyErrors } from '../../modules/errors'
import {
  parseCreateGame,
  parseGameRequest,
  parseGetGamesList,
  parseLinkAccount,
  parseRestoreAccount,
  parseSpectatorRequest,
  payloadAndCallback,
} from '../validation'
import { errorResponse } from './errorResponse'
import { ackGameUpdated, runLobbyCommand, emitSocketError } from './shared'
import { formatGameData } from '../../services/gameView'

function isComputerOnlyGame(game: GameManager): boolean {
  return game.players.length > 0 && game.players.every(isComputerPlayer)
}

/** Опции лобби и текст ошибки для каждой из них. */
const LOBBY_OPTION_ERRORS: Record<
  Exclude<keyof GameOptions, 'password' | 'isPrivate'>,
  string
> = {
  finalScoringEnabled: LobbyErrors.InvalidFinalScoringOption,
  innsAndCathedralsEnabled: LobbyErrors.InvalidInnsAndCathedralsOption,
  riverEnabled: LobbyErrors.InvalidRiverOption,
  princessAndDragonEnabled: LobbyErrors.InvalidPrincessAndDragonOption,
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Команды жизненного цикла лобби: список партий, создание, вход, старт и
 * выход. Правка отдельных слотов живёт в `slots.ts`.
 */
export function registerLobbyHandlers(context: SocketHandlerContext) {
  const { events, guard, service, scheduler, socket } = context

  socket.on(
    SocketEvents.GetGamesList,
    async (first: unknown, second: unknown) => {
      const { callback, payload } = payloadAndCallback(first, second)
      await runLobbyCommand(callback, async () => {
        const request = parseGetGamesList(payload)
        const result = await service.getGameSummaries(request)
        callback?.({
          games: result.games,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          hasMore: result.hasMore,
        })
      })
    }
  )

  socket.on(
    SocketEvents.CreateGame,
    async (first: unknown, second: unknown) => {
      const { payload, callback } = payloadAndCallback(first, second)
      const request = parseCreateGame(payload)
      if (!request) {
        callback?.(errorResponse(CommonErrors.InvalidRequest))
        return
      }
      if (request.invalidOption) {
        callback?.(errorResponse(LOBBY_OPTION_ERRORS[request.invalidOption]))
        return
      }

      await runLobbyCommand(callback, async () => {
        const sessionId = service.getSessionBySocketId(socket.id)
        if (!sessionId) {
          callback?.(errorResponse(CommonErrors.SessionRequired))
          return
        }

        const limitError = service.lobbyCreationError(sessionId)
        if (limitError) {
          callback?.(errorResponse(limitError))
          return
        }

        const game = service.createLobby(socket.id, sessionId, request.options)
        try {
          await service.saveWithRollback(game.id, () =>
            service.deleteGame(game.id)
          )
        } catch (error) {
          callback?.(errorResponse(CommonErrors.SaveFailed))
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

  socket.on(SocketEvents.JoinGame, async (first: unknown, second: unknown) => {
    const { payload, callback } = payloadAndCallback(first, second)
    const request = parseGameRequest(payload)
    if (!request) {
      callback?.(errorResponse(CommonErrors.InvalidRequest))
      return
    }
    const { gameId } = request

    await runLobbyCommand(callback, async () => {
      const ip = guard.clientIp(socket)
      if (guard.isJoinBlocked(ip)) {
        emitSocketError(socket, service, CommonErrors.JoinAttemptsExceeded)
        callback?.(errorResponse(CommonErrors.JoinAttemptsExceeded))
        return
      }

      const existingGame = await service.resolveGame(gameId)
      const resolvedGameId = existingGame?.id
      if (!existingGame || !resolvedGameId) {
        const failure = guard.recordJoinFailure(ip)
        if (failure.delayMs > 0) await sleep(failure.delayMs)
        const error = failure.blocked
          ? CommonErrors.JoinAttemptsExceeded
          : CommonErrors.GameNotFound
        emitSocketError(socket, service, error)
        callback?.(errorResponse(error))
        return
      }
      guard.recordJoinSuccess(ip)

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

      const sessionId = service.getSessionBySocketId(socket.id)
      if (!sessionId) {
        const error = CommonErrors.SessionRequired
        emitSocketError(socket, service, error)
        callback?.(errorResponse(error))
        return
      }
      const result = service.joinFirstFreeSlot(
        resolvedGameId,
        socket.id,
        sessionId,
        request.password
      )

      if ('error' in result) {
        emitSocketError(socket, service, result.error)
        callback?.(errorResponse(result.error))
        return
      }

      if (result.alreadyJoined) {
        await socket.join(resolvedGameId)
        ackGameUpdated(events, resolvedGameId, result.game, callback)
        return
      }

      await socket.join(resolvedGameId)
      try {
        await service.saveWithRollback(resolvedGameId, () => {
          service.releasePlayer(resolvedGameId, socket.id, null)
        })
      } catch (error) {
        await socket.leave(resolvedGameId)
        callback?.(errorResponse(CommonErrors.SaveFailed))
        return
      }
      ackGameUpdated(events, resolvedGameId, result.game, callback)
    })
  })

  socket.on(
    SocketEvents.JoinSpectator,
    async (first: unknown, second: unknown) => {
      const { payload, callback } = payloadAndCallback(first, second)
      const request = parseSpectatorRequest(payload)
      if (!request) {
        callback?.(errorResponse(CommonErrors.InvalidRequest))
        return
      }
      const { gameId } = request

      await runLobbyCommand(callback, async () => {
        const ip = guard.clientIp(socket)
        if (guard.isJoinBlocked(ip)) {
          emitSocketError(socket, service, CommonErrors.JoinAttemptsExceeded)
          callback?.(errorResponse(CommonErrors.JoinAttemptsExceeded))
          return
        }

        const existingGame = await service.resolveGame(gameId)
        const resolvedGameId = existingGame?.id
        if (!existingGame || !resolvedGameId) {
          const failure = guard.recordJoinFailure(ip)
          if (failure.delayMs > 0) await sleep(failure.delayMs)
          const error = failure.blocked
            ? CommonErrors.JoinAttemptsExceeded
            : CommonErrors.GameNotFound
          emitSocketError(socket, service, error)
          callback?.(errorResponse(error))
          return
        }
        guard.recordJoinSuccess(ip)

        const sessionId = service.getSessionBySocketId(socket.id)
        if (!sessionId) {
          const error = CommonErrors.SessionRequired
          emitSocketError(socket, service, error)
          callback?.(errorResponse(error))
          return
        }

        const result = service.joinSpectator(resolvedGameId, sessionId)

        if ('error' in result) {
          emitSocketError(socket, service, result.error)
          callback?.(errorResponse(result.error))
          return
        }

        await socket.join(resolvedGameId)
        const game = formatGameData(result.game)
        socket.emit(SocketEvents.GameUpdated, game)
        callback?.({ success: true, game })
      })
    }
  )

  socket.on(
    SocketEvents.LinkAccount,
    async (first: unknown, second: unknown) => {
      const { payload, callback } = payloadAndCallback(first, second)
      const request = parseLinkAccount(payload)
      if (!request) {
        callback?.(errorResponse(CommonErrors.InvalidRequest))
        return
      }

      await runLobbyCommand(callback, async () => {
        const sessionId = service.getSessionBySocketId(socket.id)
        if (!sessionId) {
          const error = CommonErrors.SessionRequired
          emitSocketError(socket, service, error)
          callback?.(errorResponse(error))
          return
        }

        const ok = service.linkSessionToUser(sessionId, request.userId)
        if (!ok) {
          callback?.(errorResponse(CommonErrors.TooManyRequests))
          return
        }

        callback?.({ success: true })
      })
    }
  )

  socket.on(
    SocketEvents.RestoreAccount,
    async (first: unknown, second: unknown) => {
      const { payload, callback } = payloadAndCallback(first, second)
      const request = parseRestoreAccount(payload)
      if (!request) {
        callback?.(errorResponse(CommonErrors.InvalidRequest))
        return
      }

      await runLobbyCommand(callback, async () => {
        const sessionId = service.getSessionBySocketId(socket.id)
        if (!sessionId) {
          const error = CommonErrors.SessionRequired
          emitSocketError(socket, service, error)
          callback?.(errorResponse(error))
          return
        }

        service.linkSessionToUser(sessionId, request.userId)

        const gameIds = service.getUserGames(request.userId)
        const games = gameIds
          .map((id) => service.getGame(id))
          .filter((game): game is GameManager => Boolean(game))
          .map((game) => formatGameData(game))

        callback?.({ success: true, games })
      })
    }
  )

  socket.on(SocketEvents.StartGame, async (first: unknown, second: unknown) => {
    const { payload, callback } = payloadAndCallback(first, second)
    const request = parseGameRequest(payload)
    if (!request) {
      callback?.(errorResponse(CommonErrors.InvalidRequest))
      return
    }
    const { gameId } = request

    await runLobbyCommand(callback, async () => {
      const game = service.getGame(gameId)
      if (!game) {
        emitSocketError(socket, service, CommonErrors.GameNotFound)
        callback?.(errorResponse(CommonErrors.GameNotFound))
        return
      }
      const sessionId = service.getSessionBySocketId(socket.id)
      if (!sessionId || !service.canStartLobby(gameId, sessionId)) {
        emitSocketError(socket, service, LobbyErrors.OnlyLobbyOwnerCanStart)
        callback?.(errorResponse(LobbyErrors.OnlyLobbyOwnerCanStart))
        return
      }

      const startError = service.lobbyStartError(gameId)
      if (startError) {
        emitSocketError(socket, service, startError)
        callback?.(errorResponse(startError))
        return
      }

      if (isComputerOnlyGame(game)) {
        const limitError = service.aiGameStartError(sessionId)
        if (limitError) {
          emitSocketError(socket, service, limitError)
          callback?.(errorResponse(limitError))
          return
        }
        if (!guard.tryConsumeAiGameStart(guard.clientIp(socket))) {
          emitSocketError(socket, service, CommonErrors.TooManyRequests)
          callback?.(errorResponse(CommonErrors.TooManyRequests))
          return
        }
      }

      const previousGame = game
      const newGame = service.startGame(gameId)
      if (!newGame) {
        callback?.(errorResponse(LobbyErrors.StartFailed))
        return
      }

      try {
        await service.saveWithRollback(gameId, () => {
          service.restoreGame(gameId, previousGame)
        })
      } catch (error) {
        callback?.(errorResponse(CommonErrors.SaveFailed))
        return
      }

      ackGameUpdated(events, gameId, newGame, callback)

      if (newGame.players.every((p) => !p.socketId && !p.sessionId)) {
        scheduler.scheduleMove(events, service, gameId)
      }
    })
  })

  socket.on(SocketEvents.LeaveGame, async (first: unknown, second: unknown) => {
    const { payload, callback } = payloadAndCallback(first, second)
    const request = parseGameRequest(payload)
    if (!request) {
      callback?.(errorResponse(CommonErrors.InvalidRequest))
      return
    }
    const { gameId } = request

    await runLobbyCommand(callback, async () => {
      const game = service.getGame(gameId)
      if (!game) {
        emitSocketError(socket, service, CommonErrors.GameNotFound)
        callback?.(errorResponse(CommonErrors.GameNotFound))
        return
      }

      if (!game.gameIsStarted) {
        const previousState = game.captureRollbackState()
        const previousOwner = game.ownerSessionId
        service.releasePlayer(gameId, socket.id, null)
        if (game.players.every((p) => !p.socketId && !p.sessionId)) {
          try {
            await service.deleteGame(gameId)
          } catch (error) {
            game.restoreRollbackState(previousState)
            service.setLobbyOwner(gameId, previousOwner)
            callback?.(errorResponse(CommonErrors.SaveFailed))
            return
          }
          events.publishGameDeleted(gameId, 'owner_left')
          events.publishGamesList(service.formatGamesList())
        } else {
          service.reassignLobbyOwner(gameId)
          try {
            await service.saveGame(gameId)
          } catch (error) {
            game.restoreRollbackState(previousState)
            service.setLobbyOwner(gameId, previousOwner)
            callback?.(errorResponse(CommonErrors.SaveFailed))
            return
          }
        }
      } else if (!game.gameIsEnded) {
        // Явный выход меняет участие в партии, поэтому фиксируется в хранилище
        // до подтверждения: после перезапуска сервер не должен вернуть игрока
        // в слот по устаревшему сохранению.
        try {
          await service.runGameCommand(gameId, () =>
            service.mutateAndSave(gameId, async () => {
              service.releasePlayer(gameId, socket.id)
            })
          )
        } catch (error) {
          callback?.(errorResponse(CommonErrors.SaveFailed))
          return
        }
        scheduler.continueGame(events, service, gameId)
      }

      await socket.leave(gameId)
      ackGameUpdated(events, gameId, game, callback)
    })
  })
}
