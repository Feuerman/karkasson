import notificationService from '@/plugins/notification'
import { t, tError } from './i18n'

/**
 * Текст ошибки для показа игроку.
 *
 * Сервер присылает причину отказа вместе с машинным кодом (`code`). Если у
 * ошибки есть код, текст берётся из переводов по этому коду — сервер не
 * диктует язык, клиент показывает сообщение на выбранном игроком языке.
 * Если кода нет, показывается текст ошибки как есть; при отсутствии текста
 * — запасной вариант.
 */
export const errorMessage = (
  error: unknown,
  fallbackMessage = t('ui_error_generic')
): string => {
  if (error instanceof Error && error.message) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as Record<string, unknown>).code === 'string'
    ) {
      return tError(
        (error as Record<string, unknown>).code as string,
        error.message
      )
    }
    return error.message
  }
  if (typeof error === 'string' && error) {
    return error
  }
  return fallbackMessage
}

export const notifyError = (
  error: unknown,
  fallbackMessage = t('ui_error_generic')
): void => {
  notificationService.error(errorMessage(error, fallbackMessage))
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

export const pluralForm = (
  count: number,
  one: string,
  two: string,
  five: string
): string => {
  return count % 10 === 1 && count % 100 !== 11
    ? one
    : count % 10 >= 2 &&
        count % 10 <= 4 &&
        (count % 100 < 10 || count % 100 >= 20)
      ? two
      : five
}

export const throttle = <T extends (...args: never[]) => void>(
  fn: T,
  delay: number
) => {
  let timeout: NodeJS.Timeout | null = null

  const throttled = (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      fn(...args)
      timeout = null
    }, delay)
  }

  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  return throttled
}
