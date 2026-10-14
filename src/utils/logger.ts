export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

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
}

const CONSOLE_METHOD: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
}

export function createLogger(scope: string): Logger {
  const threshold = import.meta.env.DEV
    ? LEVEL_PRIORITY.debug
    : LEVEL_PRIORITY.info

  const write =
    (level: LogLevel): LogMethod =>
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
