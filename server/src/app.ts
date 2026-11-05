import { timingSafeEqual } from 'node:crypto'
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { instrument } from '@socket.io/admin-ui'
import {
  ADMIN_UI_ORIGIN,
  getClientOrigins,
  getDiagnosticsToken,
  getSessionSecret,
  getSocketAdminUIOptions,
  HTTP_HEADERS_TIMEOUT_MS,
  HTTP_REQUEST_TIMEOUT_MS,
  IS_PRODUCTION,
  isSocketAdminUIEnabled,
  MAX_HTTP_BUFFER_SIZE,
  SOCKET_CONNECT_TIMEOUT_MS,
  SOCKET_PING_INTERVAL_MS,
  SOCKET_PING_TIMEOUT_MS,
  SOCKET_UPGRADE_TIMEOUT_MS,
  TRUST_PROXY,
} from './config'
import type { IGameDatabase } from './modules/Database'
import type { GameServiceLimits } from './services/GameService'
import { GameService } from './services/GameService'
import { SocketAbuseGuard } from './socket/abuseGuard'
import type { SocketAbuseGuardOptions } from './socket/abuseGuard'
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
  clientOrigins?: string[]
  diagnosticsToken?: string | null
  maxHttpBufferSize?: number
  gameLimits?: Partial<GameServiceLimits>
  abuseGuard?: SocketAbuseGuardOptions
}

/**
 * Канонический вид Origin для сравнения. Невалидное значение (в том числе
 * литерал `null` из sandbox-iframe) не совпадает ни с одним разрешённым.
 */
function canonicalOrigin(origin: string): string | null {
  try {
    return new URL(origin).origin
  } catch {
    return null
  }
}

function isLoopbackOrigin(origin: string): boolean {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  return (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]'
  )
}

/**
 * Проверка Origin для CORS и рукопожатия Socket.IO.
 *
 * Запросы без Origin — не браузерные (серверные клиенты, тесты), их не
 * блокируем. В разработке и тестах дополнительно разрешены любые loopback-
 * адреса: Vite поднимается на случайном порту. В production это отключено.
 */
function createOriginValidator(
  allowedOrigins: string[],
  allowLoopback: boolean
): (origin: string | undefined) => boolean {
  const allowed = new Set(
    allowedOrigins
      .map(canonicalOrigin)
      .filter((origin): origin is string => origin !== null)
  )

  return (origin) => {
    if (!origin) return true
    const canonical = canonicalOrigin(origin)
    if (!canonical) return false
    if (allowed.has(canonical)) return true
    return allowLoopback && isLoopbackOrigin(canonical)
  }
}

function hasValidBearerToken(
  authorization: string | undefined,
  token: string
): boolean {
  const prefix = 'Bearer '
  if (!authorization?.startsWith(prefix)) return false

  const provided = Buffer.from(authorization.slice(prefix.length))
  const expected = Buffer.from(token)
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  )
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
  const {
    adminUI = isSocketAdminUIEnabled(),
    clientOrigins = getClientOrigins(),
    diagnosticsToken = getDiagnosticsToken(),
  } = options

  const app = express()
  app.disable('x-powered-by')
  const server = http.createServer(app)
  server.requestTimeout = HTTP_REQUEST_TIMEOUT_MS
  server.headersTimeout = HTTP_HEADERS_TIMEOUT_MS

  // Express должен видеть реальный IP и протокол за обратным прокси, иначе
  // ограничения по IP и HSTS работают по адресу прокси.
  app.set('trust proxy', TRUST_PROXY)

  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('X-Frame-Options', 'DENY')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()'
    )
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    )
    if (request.secure || IS_PRODUCTION) {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      )
    }
    next()
  })

  const adminUIOptions = adminUI ? getSocketAdminUIOptions() : null
  if (adminUI && !adminUIOptions) {
    logger.warn(
      'Socket.IO Admin UI is disabled: configure its username and password hash'
    )
  }

  const allowedOrigins = [...clientOrigins]
  if (adminUIOptions) allowedOrigins.push(ADMIN_UI_ORIGIN)
  const isOriginAllowed = createOriginValidator(allowedOrigins, !IS_PRODUCTION)

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
      credentials: true,
      methods: ['GET', 'POST'],
    },
    allowRequest: (request, callback) => {
      const origin = request.headers.origin
      if (origin && !isOriginAllowed(origin)) {
        logger.warn(
          `Rejected Socket.IO handshake from disallowed origin "${origin}"`
        )
        callback('Origin not allowed', false)
        return
      }
      callback(null, true)
    },
    maxHttpBufferSize: options.maxHttpBufferSize ?? MAX_HTTP_BUFFER_SIZE,
    pingInterval: SOCKET_PING_INTERVAL_MS,
    pingTimeout: SOCKET_PING_TIMEOUT_MS,
    upgradeTimeout: SOCKET_UPGRADE_TIMEOUT_MS,
    connectTimeout: SOCKET_CONNECT_TIMEOUT_MS,
  })

  if (adminUIOptions) {
    instrument(io, adminUIOptions)
  }

  const gameService = new GameService(
    db,
    getSessionSecret(),
    options.gameLimits
  )
  const events = createGameEventsPublisher(io)
  const abuseGuard = new SocketAbuseGuard(options.abuseGuard)

  registerSocketHandlers(io, gameService, events, abuseGuard)

  /**
   * Публичная проверка живости. Не раскрывает состояние хранилища и другие
   * внутренние детали: подробности доступны только на защищённом endpoint.
   *
   * Отвечает 200, пока сервер работает, даже если часть сохранений не читается:
   * нечитаемое сохранение — потеря одной партии, а не отказ хранилища.
   */
  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' })
  })

  /**
   * Диагностика для эксплуатации. Требует HEALTH_TOKEN и отдаёт 404, если
   * токен не настроен: endpoint не должен существовать для посторонних.
   */
  app.get('/health/details', (request, response) => {
    if (!diagnosticsToken) {
      response.status(404).json({ error: 'Not found' })
      return
    }

    if (!hasValidBearerToken(request.headers.authorization, diagnosticsToken)) {
      response.status(401).json({ error: 'Unauthorized' })
      return
    }

    response.json({
      status: 'ok',
      storage: gameService.storageStatus(),
      uptimeSeconds: Math.round(process.uptime()),
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
    gameService.computerMoves.cancelAll(
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
    events,
    gameService,
    db,
    close,
  }
}
