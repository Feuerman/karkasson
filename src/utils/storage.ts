/**
 * Безопасные операции с localStorage.
 *
 * В приватном режиме браузера, при отключённом хранилище или при исчерпании
 * квоты чтение/запись localStorage бросают исключение. Обёртки ниже гасят
 * ошибку, чтобы приложение не падал: настройка или метка просто не
 * сохранятся до перезагрузки.
 */

const getStorage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Чтение значения по ключу. При ошибке хранилища возвращает null. */
export function readStorageItem(key: string): string | null {
  const storage = getStorage()
  if (!storage) return null
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

/** Запись значения по ключу. Ошибка хранилища игнорируется. */
export function writeStorageItem(key: string, value: string): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(key, value)
  } catch {
    // Хранилище недоступно или переполнено: значение проживёт до перезагрузки.
  }
}

/** Удаление значения по ключу. Ошибка хранилища игнорируется. */
export function removeStorageItem(key: string): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch {
    // Хранилище недоступно: удаление просто не сохранится.
  }
}
