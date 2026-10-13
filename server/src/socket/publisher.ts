import type { Server } from 'socket.io'
import { SocketEvents } from '../modules/types'
import type { GameData, GameSummary } from '../services/GameService'
import type { GameEventsPublisher } from '../services/gameEvents'

/**
 * Реализация порта публикации поверх Socket.IO. Единственное место в
 * серверном коде, где игровые события превращаются в сетевые сообщения.
 */
export function createGameEventsPublisher(io: Server): GameEventsPublisher {
  return {
    publishGameUpdated(gameId: string, game: GameData): void {
      io.to(gameId).emit(SocketEvents.GameUpdated, game)
    },

    publishGameError(gameId: string, message: string): void {
      io.to(gameId).emit(SocketEvents.GameError, { message })
    },

    publishGameDeleted(gameId: string): void {
      io.to(gameId).emit(SocketEvents.GameDeleted)
    },

    publishGamesList(games: GameSummary[]): void {
      io.emit(SocketEvents.UpdateGamesList, games)
    },
  }
}
