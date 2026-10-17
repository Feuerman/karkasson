/**
 * Управление записью в тестовое хранилище.
 *
 * Сервер сохраняет партию в конце каждой команды, поэтому задержка или сбой
 * записи позволяют поймать следующую команду в полёте и проверить
 * последовательность применения команд и откат неудачной.
 */

import type { InMemoryDatabase } from './inMemoryDatabase'

/** Все записи встают на паузу на `delayMs`; промис отпускает их. */
export function delaySaves(db: InMemoryDatabase, delayMs = 100): Promise<void> {
  const release = new Promise<void>((resolve) => setTimeout(resolve, delayMs))
  db.beforeSave = async () => {
    await release
  }
  return release
}

/**
 * Первая запись после вызова падает с `error`, следующие проходят как обычно.
 * Пауза нужна, чтобы вторая команда успела изменить состояние до отката первой.
 */
export function failNextSave(
  db: InMemoryDatabase,
  error: Error,
  delayMs = 60
): Promise<void> {
  const release = new Promise<void>((resolve) => setTimeout(resolve, delayMs))
  let failed = false
  db.beforeSave = async () => {
    await release
    if (failed) return
    failed = true
    throw error
  }
  return release
}
