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
  setInterval(() => {
    const deletedGameIds = gameService.deleteStaleGames(
      GAME_INACTIVITY_TIMEOUT_MS
    )

    deletedGameIds.forEach((gameId) => {
      io.to(gameId).emit('gameDeleted')
    })

    if (deletedGameIds.length) {
      io.emit('updateGamesList', gameService.formatGamesList())
    }
  }, STALE_GAMES_CHECK_MS)
}

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`)

  await gameService.loadSavedGames()
  console.log(`Loaded ${gameService.allGames().length} saved game(s)`)

  startStaleGamesCleanup()
})