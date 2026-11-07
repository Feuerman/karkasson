import type { Server } from 'socket.io'
import { CommonErrors } from '../modules/errors'
import type { GameService } from '../services/GameService'
import type { GameEventsPublisher } from '../services/gameEvents'
import { createLogger } from '../utils/logger'
import { metrics } from '../metrics/registry'
import type { SocketAbuseGuard } from './abuseGuard'
import { errorResponse } from './handlers/errorResponse'
import { registerConnectionHandlers } from './handlers/connection'
import { registerLobbyHandlers } from './handlers/lobby'
import { registerSlotHandlers } from './handlers/slots'
import { registerGameHandlers } from './handlers/game'
import type { SocketCallback } from './types'

const logger = createLogger('socket')

const connectionsTotal = metrics.counter(
  'wsocket_connections_total',
  'Total number of WebSocket connections'
)
const connectionsActive = metrics.gauge(
  'wsocket_connections_active',
  'Number of active WebSocket connections'
)
const commandsRateLimited = metrics.counter(
  'wsocket_command_rate_limited_total',
  'Total number of rate-limited commands'
)

export function registerSocketHandlers(
  io: Server,
  service: GameService,
  events: GameEventsPublisher,
  guard: SocketAbuseGuard
): void {
  io.use((socket, next) => {
    const ip = guard.clientIp(socket)
    if (!guard.canAcceptConnection(ip)) {
      logger.warn(`Rejected connection: too many sockets for ${ip}`)
      next(new Error(CommonErrors.TooManyConnections))
      return
    }
    next()
  })

  io.on('connection', (socket) => {
    const ip = guard.clientIp(socket)
    guard.addConnection(socket.id, ip)
    connectionsTotal.inc(1)
    connectionsActive.inc(1)
    socket.once('disconnect', () => {
      guard.removeConnection(socket.id)
      connectionsActive.dec(1)
    })

    socket.use((packet, next) => {
      const event = typeof packet[0] === 'string' ? packet[0] : ''
      const args = packet.slice(1) as unknown[]
      const last = args[args.length - 1]
      const callback =
        typeof last === 'function' ? (last as SocketCallback) : undefined
      const limit = guard.tryConsumeCommand(socket.id, ip)

      if (limit.allowed) {
        next()
        return
      }

      logger.warn(`Command rate limit exceeded for "${event}"`, {
        reason: limit.reason,
      })
      commandsRateLimited.inc(1, { reason: limit.reason })
      callback?.(errorResponse(CommonErrors.TooManyRequests))
    })

    const context = {
      events,
      service,
      scheduler: service.computerMoves,
      socket,
      io,
      guard,
    }

    registerConnectionHandlers(context)
    registerLobbyHandlers(context)
    registerSlotHandlers(context)
    registerGameHandlers(context)
  })
}
