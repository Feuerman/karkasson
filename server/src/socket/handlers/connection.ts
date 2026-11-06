import type { SocketHandlerContext } from '../types'
import type { GameManager } from '../../modules/GameManager'
import { SocketEvents } from '../../modules/types'
import { CommonErrors } from '../../modules/errors'
import { createLogger } from '../../utils/logger'
import {
  parseGameRequest,
  parseRegisterSession,
  payloadAndCallback,
} from '../validation'
import { errorResponse } from './errorResponse'
import { ackGameUpdated, runLobbyCommand } from './shared'

const logger = createLogger('connection')

function isTemporaryDisconnect(reason: string): boolean {
  return reason === 'transport close' || reason === 'ping timeout'
}

/**
 * Сохраняет партию при отключении сокета. Ошибка записи не отменяет
 * освобождение слота: партия уже изменилась в памяти, но повторять попытку
 * бессмысленно, поэтому ошибка только попадает в журнал.
 */
async function saveGameOnDisconnect(
  service: SocketHandlerContext['service'],
  gameId: string
): Promise<void> {
  try {
    await service.saveWithRollback(gameId, () => {
      // Отключение не откатывается: слот уже освобождён.
    })
  } catch (error: unknown) {
    logger.error('Failed to save game after disconnect:', error)
  }
}

/** Освобождает сокет игрока в одной партии и приводит её к устойчивому виду. */
async function releaseGameAfterDisconnect(
  context: SocketHandlerContext,
  game: GameManager,
  reason: string
): Promise<void> {
  const { events, service, scheduler, socket } = context
  const gameId = game.id
  if (!gameId) return

  if (isTemporaryDisconnect(reason)) {
    const playerIds = game.players
      .filter((p) => p.socketId === socket.id)
      .map((p) => p.id)
    socket.to(gameId).emit(SocketEvents.PlayerTemporaryDisconnected, {
      playerIds,
    })

    if (game.gameIsStarted) {
      // Сессия остаётся за игроком: он должен вернуться в свою партию.
      service.releasePlayer(gameId, socket.id)
      // Сохраняем до рассылки: игроки не должны увидеть состояние,
      // которого нет в хранилище.
      await saveGameOnDisconnect(service, gameId)
      scheduler.continueGame(events, service, gameId)
    } else {
      // В лобби слот освобождается сразу: сессия уходит вместе с сокетом.
      const previousState = game.captureRollbackState()
      const previousOwner = game.ownerSessionId
      service.releasePlayer(gameId, socket.id, null)
      if (game.players.every((p) => !p.socketId && !p.sessionId)) {
        try {
          await service.deleteGame(gameId)
        } catch (error: unknown) {
          game.restoreRollbackState(previousState)
          service.setLobbyOwner(gameId, previousOwner)
          logger.error('Failed to delete empty lobby:', error)
          return
        }
        events.publishGameDeleted(gameId, 'owner_left')
        events.publishGamesList(service.formatGamesList())
        return
      }
      service.reassignLobbyOwner(gameId)
      await saveGameOnDisconnect(service, gameId)
    }

    ackGameUpdated(events, gameId, game)
    return
  }

  if (game.gameIsStarted) {
    service.releasePlayer(gameId, socket.id)
    await saveGameOnDisconnect(service, gameId)
    scheduler.continueGame(events, service, gameId)
    ackGameUpdated(events, gameId, game)
    return
  }

  if (service.hasOtherConnectedPlayers(game, socket.id)) {
    service.releasePlayer(gameId, socket.id, null)
    service.reassignLobbyOwner(gameId)
    await saveGameOnDisconnect(service, gameId)
    ackGameUpdated(events, gameId, game)
    return
  }

  try {
    await service.deleteGame(gameId)
  } catch (error: unknown) {
    logger.error('Failed to delete game:', error)
    return
  }
  events.publishGameDeleted(gameId, 'owner_left')
  events.publishGamesList(service.formatGamesList())
}

/**
 * Обрабатывает отключение во всех партиях сокета: игрок может состоять сразу
 * в нескольких лобби, и оставленный в них `socketId` навсегда остановил бы
 * ходы компьютера в этих партиях.
 */
async function handleDisconnect(
  context: SocketHandlerContext,
  reason: string
): Promise<void> {
  const games = context.service.findPlayerGamesForSocket(context.socket.id)
  for (const game of games) {
    try {
      await releaseGameAfterDisconnect(context, game, reason)
    } catch (error: unknown) {
      // Одна партия не должна мешать освобождению остальных.
      logger.error(`Failed to release game ${game.id ?? 'unknown'}:`, error)
    }
  }
}

export function registerConnectionHandlers(context: SocketHandlerContext) {
  const { events, service, scheduler, socket } = context

  socket.on(SocketEvents.RegisterSession, (first: unknown, second: unknown) => {
    const { payload, callback } = payloadAndCallback(first, second)
    const request = parseRegisterSession(payload)
    if (!request) {
      callback?.(errorResponse(CommonErrors.InvalidRequest))
      return
    }

    const session = service.resolveSession(request.token)
    service.registerSession(session.sessionId, socket.id)
    callback?.({
      success: true,
      token: session.token,
      sessionId: session.sessionId,
    })
  })

  socket.on('disconnect', (reason: string) => {
    service.unregisterSocket(socket.id)
    if (!service.findPlayerGamesForSocket(socket.id).length) return
    // Фоновая задача с собственным обработчиком ошибок: хендлер disconnect
    // обязан вернуться сразу и не блокировать цикл событий.
    void handleDisconnect(context, reason).catch((error: unknown) => {
      logger.error('Failed to handle disconnect:', error)
    })
  })

  socket.on(
    SocketEvents.RejoinGame,
    async (first: unknown, second: unknown) => {
      const { payload, callback } = payloadAndCallback(first, second)
      const request = parseGameRequest(payload)
      if (!request) {
        callback?.(errorResponse(CommonErrors.InvalidRequest))
        return
      }
      const { gameId } = request

      await runLobbyCommand(callback, async () => {
        const sessionId = service.getSessionBySocketId(socket.id)
        if (!sessionId) {
          socket.emit(SocketEvents.Error, CommonErrors.SessionRequired)
          callback?.(errorResponse(CommonErrors.SessionRequired))
          return
        }

        const resolvedGame = await service.resolveGame(gameId)
        if (!resolvedGame?.id) {
          socket.emit(SocketEvents.Error, CommonErrors.GameNotFound)
          callback?.(errorResponse(CommonErrors.GameNotFound))
          return
        }

        const result = service.rejoinGame(resolvedGame.id, sessionId, socket.id)
        if (!result) {
          socket.emit(SocketEvents.Error, CommonErrors.GameNotFound)
          callback?.(errorResponse(CommonErrors.GameNotFound))
          return
        }

        const { game, players } = result
        if (players.length > 0) {
          await socket.join(game.id ?? gameId)
          ackGameUpdated(context.events, game.id ?? gameId, game, callback)
        } else {
          socket.emit(SocketEvents.Error, CommonErrors.PlayerNotFoundInGame)
          callback?.(errorResponse(CommonErrors.PlayerNotFoundInGame))
          return
        }

        if (game.gameIsStarted) {
          scheduler.continueGame(events, service, game.id ?? gameId)
        }
      })
    }
  )
}
