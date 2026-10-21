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
 * одинаков и делается одним способом.
 */
export function registerSlotHandlers(context: SocketHandlerContext) {
  const { events, service, socket } = context

  /**
   * Общая часть правки слота: проверка права, изменение, сохранение и откат
   * к прежнему списку игроков, если запись не удалась.
   */
  const editSlot = async (
    gameId: string,
    index: number,
    callback: SocketCallback,
    change: () => void
  ) => {
    const currentGame = service.getGame(gameId)
    if (!currentGame || !service.canEditLobbySlot(gameId, socket.id, index)) {
      callback?.({ error: LobbyErrors.SlotEditForbidden })
      return
    }

    const previousPlayers = snapshotPlayers(currentGame.players)
    change()

    try {
      await service.saveWithRollback(gameId, () => {
        currentGame.players = previousPlayers
      })
    } catch (error) {
      callback?.({ error: CommonErrors.SaveFailed })
      return
    }

    ackGameUpdated(events, gameId, currentGame, callback)
  }

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
        await editSlot(gameId, index, callback, () => {
          service.addPlayer(gameId, index, {
            name,
            socketId: socket.id,
            deviceId,
          })
        })
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
        if (typeof keepAsComputer !== 'boolean') {
          callback?.({ error: LobbyErrors.SlotEditForbidden })
          return
        }
        await editSlot(gameId, index, callback, () => {
          service.removePlayer(gameId, index, keepAsComputer)
        })
      })
    }
  )
}
