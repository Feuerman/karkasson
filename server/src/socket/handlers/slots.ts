import type { SocketCallback, SocketHandlerContext } from '../types'
import { SocketEvents } from '../../modules/types'
import { CommonErrors, LobbyErrors } from '../../modules/errors'
import { ackGameUpdated, runLobbyCommand } from './shared'

/** Снимок списка игроков для отката неудачного изменения слота. */
function snapshotPlayers<T>(players: T[]): T[] {
  return structuredClone(players)
}

/**
 * Правка состава лобби: игроки занимают и освобождают слоты. Обе команды
 * меняют только список игроков, поэтому откат после неудачного сохранения
 * одинаков.
 */
export function registerSlotHandlers(context: SocketHandlerContext) {
  const { events, service, socket } = context

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
      await runLobbyCommand(callback, async () => {
        const deviceId = service.getDeviceBySocketId(socket.id)
        if (!service.canEditLobbySlot(gameId, socket.id, index)) {
          callback?.({ error: LobbyErrors.SlotEditForbidden })
          return
        }
        const currentGame = service.getGame(gameId)
        if (!currentGame) {
          callback?.({ error: CommonErrors.GameNotFound })
          return
        }
        const previousPlayers = snapshotPlayers(currentGame.players)
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
            error: CommonErrors.SaveFailed,
          })
          return
        }
        ackGameUpdated(events, service, gameId, currentGame, callback)
      })
    }
  )

  socket.on(
    SocketEvents.RemovePlayer,
    async (
      {
        gameId,
        index,
        keepAsComputer,
      }: { gameId: string; index: number; keepAsComputer: boolean },
      callback: SocketCallback
    ) => {
      await runLobbyCommand(callback, async () => {
        const currentGame = service.getGame(gameId)
        if (
          !currentGame ||
          !service.canEditLobbySlot(gameId, socket.id, index) ||
          typeof keepAsComputer !== 'boolean'
        ) {
          callback?.({ error: LobbyErrors.SlotEditForbidden })
          return
        }
        const previousPlayers = snapshotPlayers(currentGame.players)
        service.removePlayer(gameId, index, keepAsComputer)

        try {
          await service.saveGame(gameId)
        } catch (error) {
          currentGame.players = previousPlayers
          callback?.({
            error: CommonErrors.SaveFailed,
          })
          return
        }
        ackGameUpdated(events, service, gameId, currentGame, callback)
      })
    }
  )
}
