export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

type WritableLogLevel = Exclude<LogLevel, 'silent'>
type LogMethod = (message: string, ...details: unknown[]) => void

export interface Logger {
  debug: LogMethod
  info: LogMethod
  warn: LogMethod
  error: LogMethod
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

export function createLogger(scope: string): Logger {
  const threshold = LEVEL_PRIORITY[configuredLevel()]

  const write =
    (level: WritableLogLevel): LogMethod =>
    (message, ...details) => {
      if (LEVEL_PRIORITY[level] < threshold) return
      CONSOLE_METHOD[level](
        `[${level.toUpperCase()}] [${scope}] ${message}`,
        ...details
      )
    }

  return {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
  }
}
