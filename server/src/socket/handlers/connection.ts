import type { SocketCallback, SocketHandlerContext } from '../types'
import type { GameService } from '../../services/GameService'
import { continueComputerGame } from '../../services/computerPlayer'
import { SocketEvents } from '../../modules/types'
import { CommonErrors } from '../../modules/errors'
import { ackGameUpdated } from './shared'

function isTemporaryDisconnect(reason: string): boolean {
  return reason === 'transport close' || reason === 'ping timeout'
}

/**
 * Сохраняет партию при отключении сокета. Ошибка записи не отменяет
 * освобождение слота: партия уже изменилась в памяти, но повторять попытку
 * бессмысленно, поэтому ошибка только попадает в журнал.
 */
async function saveGameOnDisconnect(
  service: GameService,
  gameId: string
): Promise<void> {
  try {
    await service.saveGame(gameId)
  } catch (error: unknown) {
    console.error('Failed to save game after disconnect:', error)
  }
}

export function registerConnectionHandlers({
  io,
  service,
  socket,
}: SocketHandlerContext) {
  socket.on(
    SocketEvents.RegisterDevice,
    ({ deviceId }: { deviceId: string }) => {
      service.registerDevice(deviceId, socket.id)
    }
  )

  socket.on('disconnect', async (reason: string) => {
    const deviceId = service.getDeviceBySocketId(socket.id)
    const [game] = service.findPlayerGamesForSocket(socket.id)
    if (!game?.id) return
    const gameId = game.id

    if (isTemporaryDisconnect(reason)) {
      const playerIds = game.players.filter((p) => p.socketId === socket.id)
      socket
        .to(gameId)
        .emit(SocketEvents.PlayerTemporaryDisconnected, { deviceId, playerIds })

      if (game.gameIsStarted) {
        service.releasePlayerToDevice(gameId, socket.id, deviceId)
        // Сохраняем до рассылки: игроки не должны увидеть состояние,
        // которого нет в хранилище.
        await saveGameOnDisconnect(service, gameId)
        continueComputerGame(io, service, gameId)
      } else {
        service.releasePlayerSlot(gameId, socket.id)
      }

      ackGameUpdated(io, service, gameId, game)
      return
    }

    if (game.gameIsStarted) {
      service.clearPlayerSocket(gameId, socket.id)
      await saveGameOnDisconnect(service, gameId)
      continueComputerGame(io, service, gameId)
      ackGameUpdated(io, service, gameId, game)
      return
    }

    if (service.hasOtherConnectedPlayers(game, socket.id)) {
      service.releasePlayerSlot(gameId, socket.id)
      await saveGameOnDisconnect(service, gameId)
      ackGameUpdated(io, service, gameId, game)
    } else {
      try {
        await service.deleteGame(gameId)
      } catch (error: unknown) {
        console.error('Failed to delete game:', error)
        return
      }
      io.to(gameId).emit(SocketEvents.GameDeleted)
      io.emit(SocketEvents.UpdateGamesList, service.formatGamesList())
    }
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
      const result = service.rejoinGame(gameId, deviceId, socket.id)
      if (!result) {
        socket.emit(SocketEvents.Error, CommonErrors.GameNotFound)
        callback?.({ error: CommonErrors.GameNotFound })
        return
      }

      const { game, players } = result
      if (players.length > 0) {
        await socket.join(gameId)
        ackGameUpdated(io, service, gameId, game, callback)
      } else {
        socket.emit(SocketEvents.Error, CommonErrors.PlayerNotFoundInGame)
        callback?.({ error: CommonErrors.PlayerNotFoundInGame })
        return
      }

      if (game.gameIsStarted) continueComputerGame(io, service, gameId)
    }
  )
}
