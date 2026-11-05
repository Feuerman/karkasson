/**
 * Приведение текста отказа к тому, что видит игрок.
 *
 * Ошибка может прийти из любого слоя: правил игры, лобби, хранилища. В ack
 * игроку попадает только сообщение из каталога ошибок или подробное описание
 * конфликта размещения; всё остальное (ошибки сериализации, хранилища,
 * жизненного цикла) заменяется общим `CommonErrors.InternalFailure`, чтобы
 * служебный текст не путался с причиной отказа.
 */

import {
  CommonErrors,
  GameErrors,
  LobbyErrors,
  errorCodeForMessage,
} from '../../modules/errors'
import { getErrorMessage } from '../../utils/common'
import { PLACEMENT_FAILURE_MESSAGE } from './placementErrors'

const PLAYER_MESSAGES: ReadonlySet<string> = new Set<string>([
  ...Object.values(CommonErrors),
  ...Object.values(LobbyErrors),
  ...Object.values(GameErrors),
])

/** Текст ошибки для игрока: известное сообщение или общий отказ. */
export function toPlayerErrorMessage(error: unknown): string {
  const message = getErrorMessage(error)
  if (
    PLAYER_MESSAGES.has(message) ||
    message.startsWith(PLACEMENT_FAILURE_MESSAGE)
  ) {
    return message
  }
  return CommonErrors.InternalFailure
}

/** Текст и машинный код отказа для ack игрока. */
export function toPlayerError(error: unknown): {
  error: string
  code: string
} {
  const message = toPlayerErrorMessage(error)
  return {
    error: message,
    code: message.startsWith(PLACEMENT_FAILURE_MESSAGE)
      ? 'game.placement_failed'
      : errorCodeForMessage(message),
  }
}
