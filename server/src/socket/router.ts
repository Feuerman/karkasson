import type { Server } from 'socket.io'
import type { GameService } from '../services/GameService'
import { registerConnectionHandlers } from './handlers/connection'
import { registerGameHandlers } from './handlers/game'
import { registerLobbyHandlers } from './handlers/lobby'
import { registerSlotHandlers } from './handlers/slots'
import { createGameEventsPublisher } from './publisher'

export function registerSocketHandlers(io: Server, service: GameService): void {
  const events = createGameEventsPublisher(io)

  io.on('connection', (socket) => {
    const context = { events, service, socket }

    registerConnectionHandlers(context)
    registerLobbyHandlers(context)
    registerSlotHandlers(context)
    registerGameHandlers(context)
  })
}
