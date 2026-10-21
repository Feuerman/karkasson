/**
 * Формат сохранения партии.
 *
 * Здесь живут envelope схемы, версии и преобразования данных: запись состояния
 * в строку и разбор строки обратно в состояние. Проверки и нормализация
 * записи — в `gameSaveValidation`, единственном месте, где состояние
 * приводится к каноническому виду.
 */

import { pickGameState, type IGameState } from './gameState'
import type { GameSummaryRecord } from './Database'
import { SaveErrors } from './errors'
import {
  isRecord,
  migrateLegacyGameState,
  parseJsonValue,
  validateOutgoingState,
} from './gameSaveValidation'

export const GAME_SAVE_SCHEMA_VERSION = 7

/** Версии envelope, которые ещё можно прочитать. */
const SUPPORTED_SCHEMA_VERSIONS = [1, 2, 3, 4, 5, 6, GAME_SAVE_SCHEMA_VERSION]

interface VersionedGameSave {
  schemaVersion: number
  state: unknown
}

export function serializeGameState(game: IGameState): string {
  // Migration normalizes these containers in place. Copy only those mutable
  // containers so serialization can validate without cloning the whole game
  // through an intermediate JSON string.
  const state = {
    ...pickGameState(game),
    rules: {
      ...game.rules,
      expansions: { ...game.rules.expansions },
    },
    temporaryObjects: {
      ...game.temporaryObjects,
      gardens: game.temporaryObjects.gardens ?? [],
    },
    completedObjects: {
      ...game.completedObjects,
      gardens: game.completedObjects.gardens ?? [],
    },
    playersFollowers: Object.fromEntries(
      Object.entries(game.playersFollowers).map(([playerId, pool]) => [
        playerId,
        { ...pool },
      ])
    ),
  }
  // Проверяется только форма: состояние пришло из домена, а глубокая проверка
  // тайлов и объектов стоила бы столько же, сколько сама запись.
  validateOutgoingState(state)
  const save: VersionedGameSave = {
    schemaVersion: GAME_SAVE_SCHEMA_VERSION,
    state,
  }
  return JSON.stringify(save)
}

/** Поля сводки: ровно те, что нужны списку лобби. */
const SUMMARY_FIELDS = [
  'roomCode',
  'players',
  'currentPlayer',
  'gameIsEnded',
  'moveCounter',
  'scores',
  'gameIsStarted',
  'lastUpdate',
  'rules',
  'finalScoringEnabled',
] as const satisfies readonly (keyof GameSummaryRecord)[]

export function deserializeGameState(raw: unknown): IGameState {
  const parsed = parseJsonValue(raw)
  if (!isRecord(parsed)) throw new Error(SaveErrors.SaveMustBeObject)

  if ('schemaVersion' in parsed) {
    if (!SUPPORTED_SCHEMA_VERSIONS.includes(Number(parsed.schemaVersion))) {
      throw new Error(
        `Unsupported game save schema version: ${String(parsed.schemaVersion)}`
      )
    }
    return migrateLegacyGameState(parsed.state)
  }

  // Saves produced before schema envelopes were introduced are version 0.
  return migrateLegacyGameState(parsed)
}

/**
 * Краткие сведения о партии из сохранения, без полной десериализации.
 *
 * Список лобби запрашивается при каждом входе клиента и при каждом
 * обновлении, а полный разбор сохранения запускает проверки и миграцию всех
 * тайлов и объектов доски. Здесь нужен только заголовок партии, поэтому берутся
 * перечисленные поля напрямую, без валидации остального состояния.
 *
 * Возвращает `undefined`, если запись нечитаема: партия без `id` в списке
 * лобби показать нельзя, и молча пропустить её лучше, чем уронить весь список.
 */
export function readGameSummary(raw: unknown): GameSummaryRecord | undefined {
  let parsed: unknown
  try {
    parsed = parseJsonValue(raw)
  } catch {
    return undefined
  }
  if (!isRecord(parsed)) return undefined

  const state = 'schemaVersion' in parsed ? parsed.state : parsed
  if (!isRecord(state) || typeof state.id !== 'string' || !state.id) {
    return undefined
  }

  const summary: GameSummaryRecord = { id: state.id }
  for (const field of SUMMARY_FIELDS) {
    if (state[field] !== undefined) {
      Object.assign(summary, { [field]: state[field] })
    }
  }
  return summary
}
