import type { Server, Socket } from 'socket.io'
import type { GameService } from '../services/GameService'
import type { ComputerMoveScheduler } from '../services/computerPlayer'
import type { GameEventsPublisher } from '../services/gameEvents'
import type { SocketAbuseGuard } from './abuseGuard'

export interface SocketHandlerContext {
  /**
   * Публикация игровых событий. Для обычной эмиссии используйте этот порт, а не
   * `Server`: иначе эмиссия расползлась бы обратно по слоям, а сервисы снова
   * зависели бы от Socket.IO.
   */
  events: GameEventsPublisher
  service: GameService
  /** Планировщик ходов компьютера: таймеры и цепочки ходов. */
  scheduler: ComputerMoveScheduler
  socket: Socket
  /** Сервер Socket.IO: нужен для передачи управления при смене вкладки. */
  io: Server
  /** Ограничители частоты, соединений и попыток входа. */
  guard: SocketAbuseGuard
}

export type SocketCallback = (response: {
  error?: string
  success?: boolean
  [key: string]: unknown
}) => void
