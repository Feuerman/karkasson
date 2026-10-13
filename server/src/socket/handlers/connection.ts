import type { SocketCallback, SocketHandlerContext } from '../types'
import type { IGameBoard } from '../../modules/GameManager'
import { continueComputerGame } from '../../services/computerPlayer'
import { SocketEvents } from '../../modules/types'
import { CommonErrors } from '../../modules/errors'
import { ackGameUpdated, runLobbyCommand } from './shared'

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
    await service.saveGame(gameId)
  } catch (error: unknown) {
    console.error('Failed to save game after disconnect:', error)
  }
}

/** Освобождает сокет игрока в одной партии и приводит её к устойчивому виду. */
async function releaseGameAfterDisconnect(
  context: SocketHandlerContext,
  game: IGameBoard,
  deviceId: string | undefined,
  reason: string
): Promise<void> {
  const { events, service, socket } = context
  const gameId = game.id
  if (!gameId) return

  if (isTemporaryDisconnect(reason)) {
    const playerIds = game.players.filter((p) => p.socketId === socket.id)
    socket.to(gameId).emit(SocketEvents.PlayerTemporaryDisconnected, {
      deviceId,
      playerIds,
    })

    if (game.gameIsStarted) {
      service.releasePlayerToDevice(gameId, socket.id, deviceId)
      // Сохраняем до рассылки: игроки не должны увидеть состояние,
      // которого нет в хранилище.
      await saveGameOnDisconnect(service, gameId)
      continueComputerGame(events, service, gameId)
    } else {
      service.releasePlayerSlot(gameId, socket.id)
    }

    ackGameUpdated(events, service, gameId, game)
    return
  }

  if (game.gameIsStarted) {
    service.clearPlayerSocket(gameId, socket.id)
    await saveGameOnDisconnect(service, gameId)
    continueComputerGame(events, service, gameId)
    ackGameUpdated(events, service, gameId, game)
    return
  }

  if (service.hasOtherConnectedPlayers(game, socket.id)) {
    service.releasePlayerSlot(gameId, socket.id)
    await saveGameOnDisconnect(service, gameId)
    ackGameUpdated(events, service, gameId, game)
    return
  }

  try {
    await service.deleteGame(gameId)
  } catch (error: unknown) {
    console.error('Failed to delete game:', error)
    return
  }
  events.publishGameDeleted(gameId)
  events.publishGamesList(service.formatGamesList())
}

/**
 * Обрабатывает отключение во всех партиях сокета: игрок может состоять сразу
 * в нескольких лобби, и оставленный в них `socketId` навсегда остановил бы
 * ходы компьютера в этих партиях.
 */
async function handleDisconnect(
  context: SocketHandlerContext,
  deviceId: string | undefined,
  reason: string
): Promise<void> {
  const games = context.service.findPlayerGamesForSocket(context.socket.id)
  for (const game of games) {
    try {
      await releaseGameAfterDisconnect(context, game, deviceId, reason)
    } catch (error: unknown) {
      // Одна партия не должна мешать освобождению остальных.
      console.error(`Failed to release game ${game.id ?? 'unknown'}:`, error)
    }
  }
}

export function registerConnectionHandlers(context: SocketHandlerContext) {
  const { events, service, socket } = context

  socket.on(
    SocketEvents.RegisterDevice,
    ({ deviceId }: { deviceId: string }) => {
      service.registerDevice(deviceId, socket.id)
    }
  )

  socket.on('disconnect', (reason: string) => {
    const deviceId = service.getDeviceBySocketId(socket.id)
    if (!service.findPlayerGamesForSocket(socket.id).length) return
    // Фоновая задача с собственным обработчиком ошибок: хендлер disconnect
    // обязан вернуться сразу и не блокировать цикл событий.
    void handleDisconnect(context, deviceId, reason).catch((error: unknown) => {
      console.error('Failed to handle disconnect:', error)
    })
  })

  socket.on(
    SocketEvents.RejoinGame,
    async (
      { gameId, deviceId }: { gameId: string; deviceId: string },
      callbackOrPayload?: unknown,
      maybeCallback?: (response: { error?: string; game?: unknown }) => void
    ) => {
      const callback: SocketCallback | undefined =
        typeof callbackOrPayload === 'function'
          ? (callbackOrPayload as SocketCallback)
          : maybeCallback

      await runLobbyCommand(callback, async () => {
        const result = service.rejoinGame(gameId, deviceId, socket.id)
        if (!result) {
          socket.emit(SocketEvents.Error, CommonErrors.GameNotFound)
          callback?.({ error: CommonErrors.GameNotFound })
          return
        }

        const { game, players } = result
        if (players.length > 0) {
          await socket.join(gameId)
          ackGameUpdated(context.events, service, gameId, game, callback)
        } else {
          socket.emit(SocketEvents.Error, CommonErrors.PlayerNotFoundInGame)
          callback?.({ error: CommonErrors.PlayerNotFoundInGame })
          return
        }

        if (game.gameIsStarted) continueComputerGame(events, service, gameId)
      })
    }
  )
}
