/**
 * Приведение текста отказа к тому, что видит игрок.
 *
 * Ошибка может прийти из любого слоя: правил игры, лобби, хранилища. В ack
 * игроку попадает только сообщение из каталога ошибок или подробное описание
 * конфликта размещения; всё остальное (ошибки сериализации, хранилища,
 * жизненного цикла) заменяется общим `CommonErrors.InternalFailure`, чтобы
 * служебный текст не путался с причиной отказа.
 *
 * Текст переводится на язык сессии игрока (`locale`), если известен.
 */

import {
  CommonErrors,
  GameErrors,
  GameSaveError,
  LobbyErrors,
  errorCodeForMessage,
  translateErrorMessage,
} from '../../modules/errors'
import { getErrorMessage } from '../../utils/common'
import { type PlacementConflict } from '../../modules/types'
import {
  PLACEMENT_FAILURE_MESSAGE,
  describePlacementFailure,
} from './placementErrors'

const PLAYER_MESSAGES: ReadonlySet<string> = new Set<string>([
  ...Object.values(CommonErrors),
  ...Object.values(LobbyErrors),
  ...Object.values(GameErrors),
])

/** Текст ошибки для игрока: известное сообщение или общий отказ. */
export function toPlayerErrorMessage(error: unknown): string {
  if (error instanceof GameSaveError) return CommonErrors.SaveFailed
  const message = getErrorMessage(error)
  if (
    PLAYER_MESSAGES.has(message) ||
    message.startsWith(PLACEMENT_FAILURE_MESSAGE)
  ) {
    return message
  }
  return CommonErrors.InternalFailure
}

/** Извлекает конфликты размещения из деталей ошибки, если они там есть. */
function placementConflicts(error: unknown): PlacementConflict[] | undefined {
  if (error === null || typeof error !== 'object') return undefined
  const details = (error as Record<string, unknown>).details
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const conflicts = (details as Record<string, unknown>).conflicts
    if (Array.isArray(conflicts)) return conflicts as PlacementConflict[]
  }
  return undefined
}

/** Текст и машинный код отказа для ack игрока, на языке сессии. */
export function toPlayerError(
  error: unknown,
  locale?: string
): {
  error: string
  code: string
} {
  if (error instanceof GameSaveError) {
    const message = CommonErrors.SaveFailed
    return {
      error: translateErrorMessage(message, locale),
      code: errorCodeForMessage(message),
    }
  }

  const message = toPlayerErrorMessage(error)

  if (message.startsWith(PLACEMENT_FAILURE_MESSAGE)) {
    const conflicts = placementConflicts(error) ?? []
    return {
      error: describePlacementFailure(conflicts, locale),
      code: 'game.placement_failed',
    }
  }

  return {
    error: translateErrorMessage(message, locale),
    code: errorCodeForMessage(message),
  }
}
