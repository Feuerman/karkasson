import type { Server } from 'socket.io'
import type { IGameBoard } from '../../modules/GameManager'
import type { GameService } from '../../services/GameService'
import { SocketEvents } from '../../modules/types'
import type { SocketCallback } from '../types'

/** Форматирует состояние один раз, публикует gameUpdated и подтверждает ack. */
export function ackGameUpdated(
  io: Server,
  service: GameService,
  gameId: string,
  game: IGameBoard,
  callback?: SocketCallback
): void {
  const gameData = service.formatGameData(game)
  io.to(gameId).emit(SocketEvents.GameUpdated, gameData)
  callback?.({ success: true, game: gameData })
}
