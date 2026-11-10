import {
  FINISHED_GAME_RETENTION_MS,
  GAME_ABANDONED_TIMEOUT_MS,
  getInstanceId,
  PORT,
  STALE_GAMES_CHECK_MS,
  validateProductionEnvironment,
} from './config'
import { createGameServer } from './app'
import { createInstanceLock } from './modules/instanceLock'
import {
  createProductionGameDatabase,
  InMemoryGameDatabase,
} from './modules/Database'
import { createLogger } from './utils/logger'
import { metrics } from './metrics/registry'

const logger = createLogger('server')

const database =
  process.env.NODE_ENV === 'production'
    ? createProductionGameDatabase()
    : new InMemoryGameDatabase()

const instanceId = getInstanceId()
const lock = createInstanceLock({
  db: database,
  instanceId,
})

let handle: Awaited<ReturnType<typeof createGameServer>> | undefined
let isShuttingDown = false
let isReady = false
let cleanupTimer: NodeJS.Timeout | undefined
let metricsTimer: NodeJS.Timeout | undefined

const processMemoryRss = metrics.gauge(
  'process_memory_rss_bytes',
  'Resident set size in bytes'
)
const processMemoryHeapUsed = metrics.gauge(
  'process_memory_heap_used_bytes',
  'Heap used in bytes'
)
const processMemoryHeapTotal = metrics.gauge(
  'process_memory_heap_total_bytes',
  'Heap total in bytes'
)
const processMemoryExternal = metrics.gauge(
  'process_memory_external_bytes',
  'External memory in bytes'
)
const processEventLoopLag = metrics.gauge(
  'process_event_loop_lag_seconds',
  'Event loop lag in seconds'
)

function startProcessMetrics(): void {
  let last = process.hrtime.bigint()
  metricsTimer = setInterval(() => {
    const now = process.hrtime.bigint()
    const expected = 1_000_000_000n
    const lag = Math.max(0, Number(now - last - expected) / 1e9)
    processEventLoopLag.set(lag)
    last = now
    const memory = process.memoryUsage()
    processMemoryRss.set(memory.rss)
    processMemoryHeapUsed.set(memory.heapUsed)
    processMemoryHeapTotal.set(memory.heapTotal)
    processMemoryExternal.set(memory.external)
  }, 1000)
  metricsTimer.unref?.()
}

/**
 * Полная остановка сервера: сначала перестаём принимать команды и досылаем
 * ходы компьютера, затем сбрасываем партии на диск, освобождаем блокировку
 * инстанса и закрываем порт.
 */
async function shutdown(exitCode: number): Promise<void> {
  if (isShuttingDown) return
  isShuttingDown = true
  clearInterval(cleanupTimer)
  clearInterval(metricsTimer)
  if (handle) {
    try {
      await handle.close()
    } catch (error: unknown) {
      logger.error('Failed to close server during shutdown:', error)
    }
  }
  await lock.release()
  process.exit(exitCode)
}

function startGamesCleanup() {
  if (!handle) {
    throw new Error('Server handle is not initialized')
  }
  const { events, gameService } = handle
  const timer = setInterval(() => {
    void gameService
      .cleanupGames({
        abandonedTimeoutMs: GAME_ABANDONED_TIMEOUT_MS,
        finishedRetentionMs: FINISHED_GAME_RETENTION_MS,
      })
      .then((deletedGames) => {
        deletedGames.forEach(({ gameId, reason }) => {
          events.publishGameDeleted(gameId, reason)
        })

        if (deletedGames.length) {
          events.publishGamesList(gameService.formatGamesList())
        }
      })
      .catch((error: unknown) => {
        logger.error('Failed to clean games:', error)
      })
  }, STALE_GAMES_CHECK_MS)
  return timer
}

async function startServer() {
  if (!handle) {
    throw new Error('Server handle is not initialized')
  }
  const { events, gameService } = handle
  logger.info(`Server running on port ${PORT}`)

  try {
    await gameService.loadSavedGames()
    await gameService.computerMoves.resumeAll(events, gameService)
    logger.info(
      `Loaded ${gameService.allGames().length} active game(s), ` +
        `${(await gameService.getGameSummaries()).total} known game(s)`
    )
  } catch (error: unknown) {
    logger.error('Failed to load saved games:', error)
    await shutdown(1)
    return
  }

  isReady = true
  logger.info('Server ready to serve traffic')

  cleanupTimer = startGamesCleanup()
  process.once('SIGINT', () => void shutdown(0))
  process.once('SIGTERM', () => void shutdown(0))
}

async function bootstrap(): Promise<void> {
  validateProductionEnvironment()

  const acquired = await lock.acquire()
  if (!acquired) {
    // Блокировку hält другой инстанс: этот процесс не стартует, чтобы не
    // раздваивать партии и не терять команды в общей базе.
    process.exit(1)
    return
  }

  handle = createGameServer(database, { readyCheck: () => isReady })
  const { server } = handle

  process.on('uncaughtException', (error: unknown) => {
    logger.error('Uncaught exception:', error)
    void shutdown(1)
  })
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled rejection:', reason)
    void shutdown(1)
  })

  server.listen(PORT, () => {
    void startServer()
    void startProcessMetrics()
  })
}

void bootstrap().catch((error: unknown) => {
  logger.error('Failed to start server:', error)
  void lock.release().then(() => process.exit(1))
})
