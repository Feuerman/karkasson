import type { Server } from 'socket.io'
import type { GameService } from '../services/GameService'
import type { GameEventsPublisher } from '../services/gameEvents'
import { registerConnectionHandlers } from './handlers/connection'
import { registerGameHandlers } from './handlers/game'
import { registerLobbyHandlers } from './handlers/lobby'
import { registerSlotHandlers } from './handlers/slots'

export function registerSocketHandlers(
  io: Server,
  service: GameService,
  events: GameEventsPublisher
): void {
  io.on('connection', (socket) => {
    const context = {
      events,
      service,
      scheduler: service.computerMoves,
      socket,
    }

    registerConnectionHandlers(context)
    registerLobbyHandlers(context)
    registerSlotHandlers(context)
    registerGameHandlers(context)
  })
}
