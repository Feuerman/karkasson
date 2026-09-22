/**
 * Глобальные полифиллы для интеграционных тестов в node-окружении.
 * Клиентский GameService использует localStorage и crypto.randomUUID
 * при конструировании — в Node этих API нет.
 */

function createLocalStorageStub(): Storage {
  const store = new Map<string, string>()
  return {
    get length(): number {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
  }
}

if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createLocalStorageStub(),
    configurable: true,
    writable: true,
  })
}

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      ...(globalThis.crypto ?? {}),
      randomUUID: () =>
        `uuid-${Date.now()}-${Math.random().toString(36).substring(2)}`,
    },
    configurable: true,
    writable: true,
  })
}
