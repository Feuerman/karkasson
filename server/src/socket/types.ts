import type { Socket } from 'socket.io'
import type { GameService } from '../services/GameService'
import type { GameEventsPublisher } from '../services/gameEvents'

export interface SocketHandlerContext {
  /**
   * Публикация игровых событий. Хендлеры не получают `Server` напрямую:
   * иначе эмиссия расползлась бы обратно по слоям, а сервисы снова
   * зависели бы от Socket.IO.
   */
  events: GameEventsPublisher
  service: GameService
  socket: Socket
}

export type SocketCallback = (response: {
  error?: string
  success?: boolean
  [key: string]: unknown
}) => void
