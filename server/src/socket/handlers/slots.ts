import type { SocketCallback, SocketHandlerContext } from '../types'
import { SocketEvents, playerNameForIndex } from '../../modules/types'
import { CommonErrors, LobbyErrors } from '../../modules/errors'
import { normalizePlayerName } from '../../modules/playerName'
import {
  parseAddPlayer,
  parseRemovePlayer,
  payloadAndCallback,
} from '../validation'
import { errorResponse } from './errorResponse'
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
    callback: SocketCallback | undefined,
    change: () => void,
    validate?: () => string | undefined
  ) => {
    const currentGame = service.getGame(gameId)
    const sessionId = service.getSessionBySocketId(socket.id)
    if (
      !currentGame ||
      !sessionId ||
      !service.canEditLobbySlot(gameId, socket.id, sessionId, index)
    ) {
      callback?.(errorResponse(LobbyErrors.SlotEditForbidden))
      return
    }

    const validationError = validate?.()
    if (validationError) {
      callback?.(errorResponse(validationError))
      return
    }

    const previousPlayers = snapshotPlayers(currentGame.players)
    change()

    try {
      await service.saveWithRollback(gameId, () => {
        currentGame.players = previousPlayers
      })
    } catch (error) {
      callback?.(errorResponse(CommonErrors.SaveFailed))
      return
    }

    ackGameUpdated(events, gameId, currentGame, callback)
  }

  socket.on(SocketEvents.AddPlayer, async (first: unknown, second: unknown) => {
    const { payload, callback } = payloadAndCallback(first, second)
    const request = parseAddPlayer(payload)
    if (!request) {
      callback?.(errorResponse(CommonErrors.InvalidRequest))
      return
    }
    const { gameId, index } = request
    const normalized = normalizePlayerName(request.name)
    if ('error' in normalized) {
      callback?.(errorResponse(normalized.error))
      return
    }
    const requestedName = normalized.name
    const effectiveName = requestedName ?? playerNameForIndex(index)

    await runLobbyCommand(callback, async () => {
      const sessionId = service.getSessionBySocketId(socket.id)
      if (!sessionId) {
        callback?.(errorResponse(CommonErrors.SessionRequired))
        return
      }
      await editSlot(
        gameId,
        index,
        callback,
        () => {
          service.addPlayer(gameId, index, {
            name: requestedName,
            socketId: socket.id,
            sessionId,
          })
        },
        () =>
          service.isPlayerNameTaken(gameId, effectiveName, index)
            ? LobbyErrors.PlayerNameTaken
            : undefined
      )
    })
  })

  socket.on(
    SocketEvents.RemovePlayer,
    async (first: unknown, second: unknown) => {
      const { payload, callback } = payloadAndCallback(first, second)
      const request = parseRemovePlayer(payload)
      if (!request) {
        callback?.(errorResponse(CommonErrors.InvalidRequest))
        return
      }
      const { gameId, index, keepAsComputer } = request

      await runLobbyCommand(callback, async () => {
        await editSlot(gameId, index, callback, () => {
          service.removePlayer(gameId, index, keepAsComputer)
        })
      })
    }
  )
}
