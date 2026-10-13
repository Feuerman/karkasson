export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export const throttle = <T extends (...args: never[]) => void>(
  fn: T,
  delay: number
) => {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      fn(...args)
      timeout = null
    }, delay)
  }
}
