import {
  FINISHED_GAME_RETENTION_MS,
  GAME_ABANDONED_TIMEOUT_MS,
  PORT,
  STALE_GAMES_CHECK_MS,
} from './config'
import { createGameServer } from './app'
import {
  createProductionGameDatabase,
  InMemoryGameDatabase,
} from './modules/Database'
import { createLogger } from './utils/logger'

const logger = createLogger('server')

const database =
  process.env.NODE_ENV === 'production'
    ? createProductionGameDatabase()
    : new InMemoryGameDatabase()
const handle = createGameServer(database)
const { server, events, gameService } = handle

process.on('uncaughtException', (error: unknown) => {
  logger.error('Uncaught exception:', error)
  void shutdown(1)
})
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection:', reason)
  void shutdown(1)
})

function startGamesCleanup() {
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

let isShuttingDown = false

/**
 * Остановка сервера: сначала перестаём принимать команды и досылаем ходы
 * компьютера, затем сбрасываем партии на диск и закрываем порт.
 *
 * Реализация одна и живёт в `createGameServer().close`: продукт и тесты
 * останавливают сервер одинаково, поэтому расхождение порядка действий
 * невозможно.
 */
async function shutdown(exitCode: number): Promise<void> {
  if (isShuttingDown) return
  isShuttingDown = true
  clearInterval(cleanupTimer)
  try {
    await handle.close()
  } catch (error: unknown) {
    logger.error('Failed to close server during shutdown:', error)
  }
  process.exit(exitCode)
}

let cleanupTimer: NodeJS.Timeout | undefined

server.listen(PORT, () => {
  void startServer()
})

async function startServer() {
  logger.info(`Server running on port ${PORT}`)

  try {
    await gameService.loadSavedGames()
    logger.info(
      `Loaded ${gameService.allGames().length} active game(s), ` +
        `${(await gameService.getGameSummaries()).length} known game(s)`
    )
    gameService.computerMoves.resumeAll(events, gameService)
  } catch (error: unknown) {
    logger.error('Failed to load saved games:', error)
    await shutdown(1)
    return
  }

  cleanupTimer = startGamesCleanup()
  process.once('SIGINT', () => void shutdown(0))
  process.once('SIGTERM', () => void shutdown(0))
}
