import type { IGameBoard } from '../../modules/GameManager'
import type { GameService } from '../../services/GameService'
import type { GameEventsPublisher } from '../../services/gameEvents'
import { createLogger } from '../../utils/logger'
import type { SocketCallback } from '../types'
import { toPlayerErrorMessage } from './playerErrors'

const logger = createLogger('socket')

/** Форматирует состояние один раз, публикует gameUpdated и подтверждает ack. */
export function ackGameUpdated(
  events: GameEventsPublisher,
  service: GameService,
  gameId: string,
  game: IGameBoard,
  callback?: SocketCallback
): void {
  const gameData = service.formatGameData(game)
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
    callback?.({ error: toPlayerErrorMessage(error) })
  })
}
