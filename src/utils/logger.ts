export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  requestId?: string
  gameId?: string
  command?: string
  durationMs?: number
  [key: string]: unknown
}

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
}

const CONSOLE_METHOD: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
}

function useJson(): boolean {
  return import.meta.env.PROD
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
  level: LogLevel,
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
  const threshold = import.meta.env.DEV
    ? LEVEL_PRIORITY.debug
    : LEVEL_PRIORITY.info

  const write =
    (level: LogLevel): LogMethod =>
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
        // отдельные аргументы console.
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
