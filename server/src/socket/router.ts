import type { Server } from 'socket.io'
import { CommonErrors } from '../modules/errors'
import type { GameService } from '../services/GameService'
import type { GameEventsPublisher } from '../services/gameEvents'
import { createLogger } from '../utils/logger'
import type { SocketAbuseGuard } from './abuseGuard'
import { errorResponse } from './handlers/errorResponse'
import { registerConnectionHandlers } from './handlers/connection'
import { registerGameHandlers } from './handlers/game'
import { registerLobbyHandlers } from './handlers/lobby'
import { registerSlotHandlers } from './handlers/slots'
import type { SocketCallback } from './types'

const logger = createLogger('socket')

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
    socket.once('disconnect', () => guard.removeConnection(socket.id))

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
      callback?.(errorResponse(CommonErrors.TooManyRequests))
    })

    const context = {
      events,
      service,
      scheduler: service.computerMoves,
      socket,
      guard,
    }

    registerConnectionHandlers(context)
    registerLobbyHandlers(context)
    registerSlotHandlers(context)
    registerGameHandlers(context)
  })
}
