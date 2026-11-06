import { setTimeout as sleep } from 'node:timers/promises'

export interface DatabaseRetryOptions {
  attempts: number
  timeoutMs: number
  baseDelayMs: number
}

/** Операция с хранилищем не уложилась в отведённое время. */
export class DatabaseTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Database operation timed out after ${timeoutMs} ms`)
    this.name = 'DatabaseTimeoutError'
  }
}

/**
 * Коды отказов, которые повтором не исправить: неверные данные, закрытый
 * доступ или отсутствующая запись. Повторять их бессмысленно и вредно —
 * ошибка должна дойти до вызывающего кода сразу.
 */
const NON_RETRYABLE_CODES = [
  'permission-denied',
  'invalid-argument',
  'not-found',
  'invalid-email',
  'user-disabled',
  'user-not-found',
  'wrong-password',
  'operation-not-allowed',
  'failed-precondition',
]

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code.toLowerCase() : undefined
}

/** Можно ли повторить операцию: сеть и таймауты — да, отказ прав — нет. */
export function isRetryableDatabaseError(error: unknown): boolean {
  if (error instanceof DatabaseTimeoutError) return true
  const code = errorCode(error)
  if (!code) return true
  return !NON_RETRYABLE_CODES.some((blocked) => code.includes(blocked))
}

function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  if (timeoutMs <= 0) return operation()

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new DatabaseTimeoutError(timeoutMs)),
      timeoutMs
    )
  })

  return Promise.race([operation(), timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/**
 * Выполняет операцию с хранилищем с таймаутом и экспоненциальной паузой между
 * повторами. Ошибки классифицируются: отказ прав и некорректные данные не
 * повторяются, сетевые сбои — повторяются, пока не кончатся попытки.
 */
export async function runDatabaseOperation<T>(
  operation: () => Promise<T>,
  options: DatabaseRetryOptions
): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.attempts))
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await withTimeout(operation, options.timeoutMs)
    } catch (error) {
      lastError = error
      if (attempt >= attempts || !isRetryableDatabaseError(error)) break
      const delayMs = options.baseDelayMs * 2 ** (attempt - 1)
      if (delayMs > 0) await sleep(delayMs)
    }
  }

  throw lastError
}
