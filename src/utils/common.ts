export const deepClone = <T>(obj: T): T => {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  } else if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T
  } else if (obj instanceof Date) {
    return new Date(obj.getTime()) as T
  } else {
    return Object.entries(obj).reduce(
      (acc, [key, value]) => {
        acc[key] = deepClone(value)
        return acc
      },
      {} as Record<string, unknown>
    ) as T
  }
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
