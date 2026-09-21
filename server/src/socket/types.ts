import type { Server, Socket } from 'socket.io'
import type { GameService } from '../services/GameService'

export interface SocketHandlerContext {
  io: Server
  service: GameService
  socket: Socket
}

export type SocketCallback = (response: {
  error?: string
  success?: boolean
  [key: string]: unknown
}) => void
