import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { instrument } from '@socket.io/admin-ui'
import { ADMIN_UI_ORIGIN, getSocketAdminUIOptions } from './config'
import type { IGameDatabase } from './modules/Database'
import { GameService } from './services/GameService'
import { cancelAllComputerMoves } from './services/computerPlayer'
import { registerSocketHandlers } from './socket/router'
import { createGameEventsPublisher } from './socket/publisher'
import type { GameEventsPublisher } from './services/gameEvents'
import { createLogger } from './utils/logger'

const logger = createLogger('app')

export interface GameServerHandle {
  app: express.Express
  server: http.Server
  io: Server
  /** Публикация игровых событий для кода вне слоя Socket.IO. */
  events: GameEventsPublisher
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
      logger.warn(
        'Socket.IO Admin UI is disabled: configure its username and password hash'
      )
    }
  }

  const gameService = new GameService(db)

  registerSocketHandlers(io, gameService)

  /**
   * Состояние сервера для внешнего наблюдения.
   *
   * Отвечает 200, пока сервер работает, даже если часть сохранений не читается:
   * нечитаемое сохранение — потеря одной партии, а не отказ хранилища.
   */
  app.get('/health', (_request, response) => {
    response.json({
      status: 'ok',
      storage: gameService.storageStatus(),
    })
  })

  /**
   * Полная остановка сервера.
   *
   * Порядок важен: сначала закрываются сокеты (новых команд больше не будет),
   * затем останавливаются таймеры ходов компьютера, и только после этого
   * сбрасываются партии на диск. Иначе очередь сохранений могла бы пополняться
   * во время сброса, и последние записи остались бы в памяти.
   */
  const close = async () => {
    await io.close()
    cancelAllComputerMoves(
      gameService.allGames().flatMap((game) => game.id ?? [])
    )
    try {
      await gameService.flushGames()
    } catch (error: unknown) {
      logger.error('Failed to flush games on shutdown:', error)
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  }

  return {
    app,
    server,
    io,
    events: createGameEventsPublisher(io),
    gameService,
    db,
    close,
  }
}
