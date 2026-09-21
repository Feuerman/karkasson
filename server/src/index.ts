import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { instrument } from '@socket.io/admin-ui'
import {
  ADMIN_UI_ORIGIN,
  GAME_INACTIVITY_TIMEOUT_MS,
  PORT,
  STALE_GAMES_CHECK_MS,
} from './config'
import { gameDatabase } from './modules/Database'
import { GameService } from './services/GameService'
import { registerSocketHandlers } from './socket/router'

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: [ADMIN_UI_ORIGIN],
    credentials: true,
  },
})

instrument(io, { auth: false })

const gameService = new GameService(gameDatabase)

registerSocketHandlers(io, gameService)

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
