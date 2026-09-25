import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { instrument } from '@socket.io/admin-ui'
import { ADMIN_UI_ORIGIN, getSocketAdminUIOptions } from './config'
import type { IGameDatabase } from './modules/Database'
import { GameService } from './services/GameService'
import { registerSocketHandlers } from './socket/router'

export interface GameServerHandle {
  app: express.Express
  server: http.Server
  io: Server
  gameService: GameService
  db: IGameDatabase
  close: () => Promise<void>
}

export interface CreateGameServerOptions {
  adminUI?: boolean
}

/**
 * Собирает HTTP + Socket.IO сервер без запуска прослушивания порта.
 * Используется продакшн-бутстрапом в index.ts и интеграционными тестами
 * (которые подставляют игровую базу вместо Firebase).
 */
export function createGameServer(
  db: IGameDatabase,
  options: CreateGameServerOptions = {}
): GameServerHandle {
  const { adminUI = true } = options

  const app = express()
  const server = http.createServer(app)
  const io = new Server(server, {
    cors: {
      origin: [ADMIN_UI_ORIGIN],
      credentials: true,
    },
  })

  if (adminUI) {
    const adminUIOptions = getSocketAdminUIOptions()

    if (adminUIOptions) {
      instrument(io, adminUIOptions)
    } else {
      console.warn(
        'Socket.IO Admin UI is disabled: configure its username and password hash'
      )
    }
  }

  const gameService = new GameService(db)

  registerSocketHandlers(io, gameService)

  const close = () =>
    new Promise<void>((resolve) => {
      io.close(() => {
        void gameService
          .flushGames()
          .catch((error: unknown) => {
            console.error('Failed to flush games on shutdown:', error)
          })
          .finally(() => {
            server.close(() => resolve())
          })
      })
    })

  return { app, server, io, gameService, db, close }
}
