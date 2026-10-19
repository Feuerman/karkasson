import { computed, ref } from 'vue'

/**
 * Ключи длительных команд лобби. Команды с одинаковым ключом делят один
 * счётчик: повторное нажатие на занятый слот не отправит второй запрос.
 */
export const pendingActionKeys = {
  createGame: () => 'createGame',
  joinGame: (gameId: string) => `joinGame:${gameId}`,
  rejoinGame: (gameId: string) => `rejoinGame:${gameId}`,
  leaveGame: () => 'leaveGame',
  startGame: () => 'startGame',
  slot: (index: number) => `slot:${index}`,
}

/**
 * Отслеживает команды, ожидающие ответа сервера, чтобы интерфейс мог показать
 * индикатор занятости и не отправлять одну и ту же команду дважды.
 */
export const usePendingActions = () => {
  const pendingKeys = ref<ReadonlySet<string>>(new Set())

  const isPending = (key: string) => pendingKeys.value.has(key)

  const pendingList = computed(() => Array.from(pendingKeys.value))

  const addKey = (key: string) => {
    pendingKeys.value = new Set(pendingKeys.value).add(key)
  }

  const removeKey = (key: string) => {
    const next = new Set(pendingKeys.value)
    next.delete(key)
    pendingKeys.value = next
  }

  /**
   * Выполняет команду под ключом и снимает индикатор в любом случае: и при
   * успехе, и при отказе сервера. Повторный вызов с тем же ключом, пока
   * предыдущий ещё выполняется, игнорируется.
   */
  const runPending = async <T>(
    key: string,
    command: () => Promise<T>
  ): Promise<T | undefined> => {
    if (isPending(key)) return undefined

    addKey(key)
    try {
      return await command()
    } finally {
      removeKey(key)
    }
  }

  return { pendingKeys, pendingList, isPending, runPending }
}
