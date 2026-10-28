import { onBeforeUnmount, ref } from 'vue'
import { copyToClipboard } from '@/utils/clipboard'

export interface UseCopyToClipboardOptions {
  /** Задержка перед сбросом флага «скопировано», мс. */
  durationMs?: number
}

/**
 * Копирование текста в буфер обмена с визуальной обратной связью.
 *
 * Возвращает флаг `copied` и функцию `copy(text)`. Флаг сбрасывается по
 * таймауту, поэтому компонент может менять иконку/надпись кнопки на время.
 */
export function useCopyToClipboard(options: UseCopyToClipboardOptions = {}) {
  const { durationMs = 2000 } = options

  const copied = ref(false)
  let timeout: ReturnType<typeof setTimeout> | undefined

  const copy = async (text: string): Promise<boolean> => {
    if (!text) return false

    const ok = await copyToClipboard(text)
    if (!ok) return false

    copied.value = true
    if (timeout !== undefined) clearTimeout(timeout)
    timeout = setTimeout(() => {
      copied.value = false
      timeout = undefined
    }, durationMs)
    return true
  }

  onBeforeUnmount(() => {
    if (timeout !== undefined) clearTimeout(timeout)
  })

  return { copied, copy }
}
