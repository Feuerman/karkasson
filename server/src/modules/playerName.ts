import { LobbyErrors } from './errors'
import { hasControlOrFormatCharacters } from './text'
import { MAX_PLAYER_NAME_LENGTH } from './types'

const PROFANITY_PATTERNS: RegExp[] = [
  /\b(?:fuck|shit|bitch|cunt|asshole|dick|pussy|whore|slut)\b/i,
  /(?:хуй|хуя|хуе|пизд|бляд|блят|ебат|ебал|ебан|ебуч|залуп|мудак|мудил|сука|сучк|пидор|пидар|педик)/i,
]

export type PlayerNameResult = { name: string | null } | { error: string }

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function profanityKey(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е')
}

function containsProfanity(value: string): boolean {
  const key = profanityKey(value)
  return PROFANITY_PATTERNS.some((pattern) => pattern.test(key))
}

/**
 * Приводит присланное имя к безопасному виду.
 *
 * `null`/`undefined` и строка из одних пробелов означают «оставить имя по
 * умолчанию»: так работает компьютерный слот. Явное имя нормализуется по
 * Unicode, очищается от управляющих символов и ограничивается по длине.
 */
export function normalizePlayerName(value: unknown): PlayerNameResult {
  if (value === null || value === undefined) return { name: null }
  if (typeof value !== 'string') return { error: LobbyErrors.PlayerNameInvalid }

  const normalized = value.normalize('NFKC')
  if (hasControlOrFormatCharacters(normalized)) {
    return { error: LobbyErrors.PlayerNameInvalid }
  }

  const name = collapseWhitespace(normalized)
  if (!name) return { name: null }
  if (Array.from(name).length > MAX_PLAYER_NAME_LENGTH) {
    return { error: LobbyErrors.PlayerNameTooLong }
  }
  if (containsProfanity(name)) {
    return { error: LobbyErrors.PlayerNameProfanity }
  }

  return { name }
}

/** Ключ сравнения имён: регистр, лишние пробелы и «ё» не создают дубликат. */
export function playerNameKey(name: string): string {
  return profanityKey(collapseWhitespace(name.normalize('NFKC')))
}
