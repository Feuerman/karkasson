import {
  GAME_INACTIVITY_TIMEOUT_MS,
  PORT,
  STALE_GAMES_CHECK_MS,
} from './config'
import { createGameServer } from './app'
import { gameDatabase } from './modules/Database'

const { server, io, gameService } = createGameServer(gameDatabase, {
  adminUI: true,
})

function startStaleGamesCleanup() {
  const timer = setInterval(() => {
    void gameService
      .deleteStaleGames(GAME_INACTIVITY_TIMEOUT_MS)
      .then((deletedGameIds) => {
        deletedGameIds.forEach((gameId) => {
          io.to(gameId).emit('gameDeleted')
        })

        if (deletedGameIds.length) {
          io.emit('updateGamesList', gameService.formatGamesList())
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to clean stale games:', error)
      })
  }, STALE_GAMES_CHECK_MS)
  return timer
}

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`)

  try {
    await gameService.loadSavedGames()
    console.log(`Loaded ${gameService.allGames().length} saved game(s)`)
  } catch (error: unknown) {
    console.error('Failed to load saved games:', error)
    server.close(() => process.exit(1))
    return
  }

  const cleanupTimer = startStaleGamesCleanup()
  let isShuttingDown = false
  const shutdown = () => {
    if (isShuttingDown) return
    isShuttingDown = true
    clearInterval(cleanupTimer)
    void gameService
      .flushGames()
      .catch((error: unknown) => {
        console.error('Failed to flush games during shutdown:', error)
      })
      .finally(() => {
        io.close()
      })
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
})
