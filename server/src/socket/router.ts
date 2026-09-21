import type { Server } from 'socket.io'
import type { GameService } from '../services/GameService'
import { registerConnectionHandlers } from './handlers/connection'
import { registerGameHandlers } from './handlers/game'
import { registerLobbyHandlers } from './handlers/lobby'

export function registerSocketHandlers(io: Server, service: GameService): void {
  io.on('connection', (socket) => {
    const context = { io, service, socket }

    registerConnectionHandlers(context)
    registerLobbyHandlers(context)
    registerGameHandlers(context)
  })
}
