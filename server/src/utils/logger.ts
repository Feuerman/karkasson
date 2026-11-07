import { AsyncLocalStorage } from 'node:async_hooks'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

export interface LogContext {
  requestId?: string
  gameId?: string
  command?: string
  durationMs?: number
  [key: string]: unknown
}

type WritableLogLevel = Exclude<LogLevel, 'silent'>
type LogMethod = (message: string, ...details: unknown[]) => void

export interface Logger {
  debug: LogMethod
  info: LogMethod
  warn: LogMethod
  error: LogMethod
  child: (context: LogContext) => Logger
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

const CONSOLE_METHOD: Record<WritableLogLevel, (...args: unknown[]) => void> = {
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
}

/** Хранилище контекста запроса, распространяемое через асинхронные вызовы. */
const contextStore = new AsyncLocalStorage<LogContext>()

/**
 * Выполняет fn в окружении с заданным контекстом логов.
 * Поля контекста (requestId, gameId, command и пр.) добавляются в каждую
 * запись лога, сделанную внутри fn.
 */
export function runWithContext<T>(context: LogContext, fn: () => T): T {
  return contextStore.run(context, fn)
}

/** Добавляет/перезаписывает поле в контекст текущего запроса. */
export function setContext(key: string, value: unknown): void {
  const store = contextStore.getStore()
  if (store) Object.assign(store, { [key]: value })
}

/** Возвращает контекст текущего запроса (пустой, если вне запроса). */
export function getContext(): LogContext {
  return contextStore.getStore() ?? {}
}

function configuredLevel(): LogLevel {
  const value = process.env.LOG_LEVEL?.toLowerCase()
  if (
    value === 'debug' ||
    value === 'info' ||
    value === 'warn' ||
    value === 'error' ||
    value === 'silent'
  ) {
    return value
  }
  return 'info'
}

function useJson(): boolean {
  const format = process.env.LOG_FORMAT
  if (format === 'json') return true
  if (format === 'text') return false
  return process.env.NODE_ENV === 'production'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Error)
  )
}

function serializeError(error: unknown): {
  name: string
  message: string
  stack?: string
} {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack }
  }
  return { name: 'Error', message: String(error) }
}

function buildRecord(
  scope: string,
  level: WritableLogLevel,
  message: string,
  baseContext: LogContext,
  details: unknown[]
): Record<string, unknown> {
  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    scope,
    msg: message,
    ...baseContext,
    ...getContext(),
  }
  const detailsList: unknown[] = []
  for (const detail of details) {
    if (isPlainObject(detail)) {
      Object.assign(record, detail)
    } else if (detail instanceof Error) {
      record.err = serializeError(detail)
    } else {
      detailsList.push(detail)
    }
  }
  if (detailsList.length > 0) record.details = detailsList
  return record
}

export function createLogger(
  scope: string,
  baseContext: LogContext = {}
): Logger {
  const threshold = LEVEL_PRIORITY[configuredLevel()]

  const write =
    (level: WritableLogLevel): LogMethod =>
    (message, ...details) => {
      if (LEVEL_PRIORITY[level] < threshold) return
      const record = buildRecord(scope, level, message, baseContext, details)
      const line = useJson()
        ? JSON.stringify(record)
        : `[${level.toUpperCase()}] [${scope}] ${message}`
      if (useJson()) {
        CONSOLE_METHOD[level](line)
      } else {
        // Текстовый режим сохраняет прежнее поведение: детали передаются как
        // отдельные аргументы console, чтобы существующие вызовы и тесты не
        // ломались. JSON-режим объединяет детали в одну структурированную строку.
        CONSOLE_METHOD[level](line, ...details)
      }
    }

  const base = {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
  }

  return {
    ...base,
    child: (context: LogContext): Logger =>
      createLogger(scope, { ...baseContext, ...context }),
  }
}
