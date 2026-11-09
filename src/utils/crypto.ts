/**
 * Безопасные обёртки над браузерными криптографическими API.
 *
 * crypto.randomUUID и structuredClone недоступны в старых браузерах и в
 * небезопасных контекстах (не HTTPS / не localhost). Без fallback'а
 * приложение упадёт при первом вызове. Здесь реализуются надёжные варианты
 * с запасным поведением, чтобы клиент не падал на старте.
 */

/** UUID v4-подобный идентификатор с fallback на псевдо-случайную строку. */
export function safeRandomUUID(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Глубокая копия значения с fallback на JSON-цикл.
 *
 * structuredClone не копирует прототипы, функции и циклические ссылки — как
 * и JSON-вариант. Для состояния игры и настроек этого достаточно.
 */
export function safeStructuredClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  const parsed: unknown = JSON.parse(JSON.stringify(value))
  return parsed as T
}
