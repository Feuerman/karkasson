import {
  GAME_INACTIVITY_TIMEOUT_MS,
  PORT,
  STALE_GAMES_CHECK_MS,
} from './config'
import { createGameServer } from './app'
import {
  createProductionGameDatabase,
  InMemoryGameDatabase,
} from './modules/Database'
import { resumeComputerGames } from './services/computerPlayer'
import { createLogger } from './utils/logger'

const logger = createLogger('server')

const database =
  process.env.NODE_ENV === 'production'
    ? createProductionGameDatabase()
    : new InMemoryGameDatabase()
const handle = createGameServer(database, { adminUI: true })
const { server, events, gameService } = handle

function startStaleGamesCleanup() {
  const timer = setInterval(() => {
    void gameService
      .deleteStaleGames(GAME_INACTIVITY_TIMEOUT_MS)
      .then((deletedGameIds) => {
        deletedGameIds.forEach((gameId) => {
          events.publishGameDeleted(gameId)
        })

        if (deletedGameIds.length) {
          events.publishGamesList(gameService.formatGamesList())
        }
      })
      .catch((error: unknown) => {
        logger.error('Failed to clean stale games:', error)
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
  await handle.close()
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
    logger.info(`Loaded ${gameService.allGames().length} saved game(s)`)
    resumeComputerGames(events, gameService)
  } catch (error: unknown) {
    logger.error('Failed to load saved games:', error)
    await shutdown(1)
    return
  }

  cleanupTimer = startStaleGamesCleanup()
  process.once('SIGINT', () => void shutdown(0))
  process.once('SIGTERM', () => void shutdown(0))
}
