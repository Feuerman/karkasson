import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { ADMIN_UI_ORIGIN } from './config'
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
    // Админку подключаем лениво: в тестах она не нужна и тянет лишние deps
    void import('@socket.io/admin-ui').then(({ instrument }) => {
      instrument(io, { auth: false })
    })
  }

  const gameService = new GameService(db)

  registerSocketHandlers(io, gameService)

  const close = () =>
    new Promise<void>((resolve) => {
      io.close(() => {
        server.close(() => resolve())
      })
    })

  return { app, server, io, gameService, db, close }
}
