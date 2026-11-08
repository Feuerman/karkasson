import type { GameManager } from '../../modules/GameManager'
import type { Socket } from 'socket.io'
import type { GameEventsPublisher } from '../../services/gameEvents'
import { SocketEvents } from '../../modules/types'
import {
  translateErrorMessage,
  errorCodeForMessage,
} from '../../modules/errors'
import { formatGameData } from '../../services/gameView'
import { createLogger } from '../../utils/logger'
import type { SocketCallback } from '../types'
import { toPlayerError } from './playerErrors'

const logger = createLogger('socket')

/** Отправляет ошибку конкретному сокету с переводом на его язык и кодом. */
export function emitSocketError(
  socket: Socket,
  service: { getSessionLocale(socketId: string): string | undefined },
  message: string
): void {
  const locale = service.getSessionLocale(socket.id)
  socket.emit(SocketEvents.Error, {
    message: translateErrorMessage(message, locale),
    code: errorCodeForMessage(message),
  })
}

/** Форматирует состояние, публикует gameUpdated и подтверждает ack. */
export function ackGameUpdated(
  events: GameEventsPublisher,
  gameId: string,
  game: GameManager,
  callback?: SocketCallback,
  options: { forceSnapshot?: boolean } = {}
): void {
  const fromIndex = options.forceSnapshot
    ? undefined
    : game.lastPublishedActionIndex
  const gameData = formatGameData(game, { fromActionIndex: fromIndex })
  if (!options.forceSnapshot) {
    game.lastPublishedActionIndex = game.actionsHistory.length - 1
  }
  events.publishGameUpdated(gameId, gameData)
  callback?.({ success: true, game: gameData })
}

/**
 * Общая обёртка лобби-команд: любой отказ, дошедший до `throw`, превращается
 * в ack с текстом ошибки вместо необработанного промиса.
 *
 * Команды, которым нужен собственный откат (освободить слот, вернуть
 * предыдущих игроков), ловят свои ошибки внутри и наружу не бросают — обёртка
 * подхватывает только то, что осталось: отказ хранилища на шаге создания
 * партии, исключение жизненного цикла игры и ошибки транспорта.
 */
export function runLobbyCommand(
  callback: SocketCallback | undefined,
  execute: () => Promise<void>
): Promise<void> {
  return execute().catch((error: unknown) => {
    logger.error('Lobby command failed:', error)
    callback?.(toPlayerError(error))
  })
}
