export const deepClone = <T>(obj: T): T => {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  } else if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T
  } else if (obj instanceof Date) {
    return new Date(obj.getTime()) as T
  } else {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (typeof value === 'object' && value !== null) {
        acc[key] = deepClone(value)
      } else {
        acc[key] = value
      }
      return acc
    }, {} as T)
  }
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export const throttle = (fn: (...args: any[]) => void, delay: number) => {
  let timeout: NodeJS.Timeout | null = null
  return (...args: any[]) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      fn(...args)
      timeout = null
    }, delay)
  }
}
