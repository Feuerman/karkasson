import type { Server } from 'socket.io'
import { COMPUTER_MOVE_DELAY_MS } from '../config'
import type { IGameBoard } from '../modules/GameManager'
import type { Player, PlayerId } from '../modules/types'
import { sleep } from '../utils/common'
import type { GameService } from './GameService'

export function isComputerPlayer(player: Player): boolean {
  return !player.socketId && !player.deviceId
}

/**
 * Таймеры уже запланированных цепочек компьютерных ходов по играм.
 * Нужно, чтобы `maybeContinueWithComputerMove`, вызываемый после каждого
 * действия человека (placeTile/placeFollower/skipFollower), не запускал
 * несколько параллельных цепочек для одной игры: они начинают гонку
 * за один и тот же ход и могут разместить один тайл несколько раз.
 */
const pendingMoveTimers = new Map<string, NodeJS.Timeout>()

/** Запускает ход компьютера с небольшой задержкой */
export function scheduleComputerMove(
  io: Server,
  service: GameService,
  gameId: string,
  delay = COMPUTER_MOVE_DELAY_MS
): void {
  if (pendingMoveTimers.has(gameId)) return

  const timer = setTimeout(() => {
    pendingMoveTimers.delete(gameId)
    void runComputerMoves(io, service, gameId)
  }, delay)

  pendingMoveTimers.set(gameId, timer)
}

/**
 * Если после хода человека очередь перешла к компьютеру —
 * планируем автоматический ход.
 */
export function maybeContinueWithComputerMove(
  io: Server,
  service: GameService,
  game: IGameBoard,
  gameId: string
): void {
  const currentPlayer = game.currentPlayer
  if (!currentPlayer) return

  const nextPlayer = game.getNextPlayer(currentPlayer.id)
  if (isComputerPlayer(nextPlayer) || isComputerPlayer(currentPlayer)) {
    scheduleComputerMove(io, service, gameId)
  }
}

/** Проигрывает ходы компьютера подряд, пока очередь не перейдёт человеку */
export async function runComputerMoves(
  io: Server,
  service: GameService,
  gameId: string
): Promise<void> {
  const game = service.getGame(gameId)
  if (!game || game.gameIsEnded || !game.currentPlayer) return
  if (!isComputerPlayer(game.currentPlayer)) return

  const currentPlayerId: PlayerId = game.currentPlayer.id

  try {
    await game.autoPlaceTile()

    const updatedGame = service.getGame(gameId)
    if (!updatedGame) return

    io.to(gameId).emit('gameUpdated', service.formatGameData(updatedGame))

    if (updatedGame.gameIsEnded) {
      await service.saveGame(gameId)
      io.emit('updateGamesList', service.formatGamesList())
      return
    }

    const nextPlayer = updatedGame.getNextPlayer(currentPlayerId)
    await service.saveGame(gameId)

    await sleep(COMPUTER_MOVE_DELAY_MS)

    if (nextPlayer && isComputerPlayer(nextPlayer)) {
      await runComputerMoves(io, service, gameId)
    }
  } catch (error) {
    console.error('Error in runComputerMoves:', error)
    io.to(gameId).emit('gameError', {
      message: 'Error processing computer move',
    })
  }
}
