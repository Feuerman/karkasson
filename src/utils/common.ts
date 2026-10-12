import notificationService from '@/plugins/notification'

export const notifyError = (
  error: unknown,
  fallbackMessage = 'Произошла ошибка'
): void => {
  if (error instanceof Error) {
    notificationService.error(error.message)
  } else if (typeof error === 'string') {
    notificationService.error(error)
  } else {
    notificationService.error(fallbackMessage)
  }
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
