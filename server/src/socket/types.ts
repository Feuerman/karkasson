import type { Socket } from 'socket.io'
import type { GameService } from '../services/GameService'
import type { ComputerMoveScheduler } from '../services/computerPlayer'
import type { GameEventsPublisher } from '../services/gameEvents'
import type { SocketAbuseGuard } from './abuseGuard'

export interface SocketHandlerContext {
  /**
   * Публикация игровых событий. Хендлеры не получают `Server` напрямую:
   * иначе эмиссия расползлась бы обратно по слоям, а сервисы снова
   * зависели бы от Socket.IO.
   */
  events: GameEventsPublisher
  service: GameService
  /** Планировщик ходов компьютера: таймеры и цепочки ходов. */
  scheduler: ComputerMoveScheduler
  socket: Socket
  /** Ограничители частоты, соединений и попыток входа. */
  guard: SocketAbuseGuard
}

export type SocketCallback = (response: {
  error?: string
  success?: boolean
  [key: string]: unknown
}) => void
