export const deepClone = <T>(obj: T): T => {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] =
      typeof value === 'object' && value !== null ? deepClone(value) : value
  }
  return result as T
}

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
