import type { Server } from 'socket.io'
import { COMPUTER_MOVE_DELAY_MS, PLAYER_RECONNECT_TIMEOUT_MS } from '../config'
import type { IGameBoard } from '../modules/GameManager'
import type { Player, PlayerId } from '../modules/types'
import { sleep } from '../utils/common'
import type { GameService } from './GameService'

export function isComputerPlayer(player: Player): boolean {
  return !player.socketId && !player.deviceId
}

export function resumeComputerGames(
  io: Server,
  service: GameService,
  reconnectTimeoutMs?: number
): void {
  service.allGames().forEach((game) => {
    if (!game.id) return
    if (!game.gameIsStarted || game.gameIsEnded) return
    continueComputerGame(io, service, game.id, reconnectTimeoutMs)
  })
}

export function continueComputerGame(
  io: Server,
  service: GameService,
  gameId: string,
  reconnectTimeoutMs?: number
): void {
  const game = service.getGame(gameId)
  if (!game || !game.gameIsStarted || game.gameIsEnded) return

  if (hasDisconnectedHuman(game)) {
    cancelComputerMove(gameId)
    const existingTimer = reconnectTimers.get(gameId)
    if (existingTimer && reconnectTimeoutMs === undefined) return
    if (existingTimer) clearTimeout(existingTimer)
    const timer = setTimeout(() => {
      reconnectTimers.delete(gameId)
      const currentGame = service.getGame(gameId)
      if (!currentGame || !hasDisconnectedHuman(currentGame)) return
      deleteComputerGame(io, service, gameId, 'players did not reconnect')
    }, reconnectTimeoutMs ?? PLAYER_RECONNECT_TIMEOUT_MS)
    reconnectTimers.set(gameId, timer)
    return
  }

  const reconnectTimer = reconnectTimers.get(gameId)
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimers.delete(gameId)

  if (!game.currentPlayer) {
    deleteComputerGame(io, service, gameId, 'missing current player')
    return
  }

  if (isComputerPlayer(game.currentPlayer)) {
    scheduleComputerMove(io, service, gameId)
  }
}

function deleteComputerGame(
  io: Server,
  service: GameService,
  gameId: string,
  reason: string
): void {
  cancelComputerMove(gameId)
  const reconnectTimer = reconnectTimers.get(gameId)
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimers.delete(gameId)

  void service
    .deleteGame(gameId)
    .then(() => {
      io.to(gameId).emit('gameDeleted')
      io.emit('updateGamesList', service.formatGamesList())
    })
    .catch((error: unknown) => {
      console.error(`Failed to delete computer game (${reason}):`, error)
    })
}

/**
 * Таймеры уже запланированных цепочек компьютерных ходов по играм.
 * Нужно, чтобы `maybeContinueWithComputerMove`, вызываемый после каждого
 * действия человека (placeTile/placeFollower/skipFollower), не запускал
 * несколько параллельных цепочек для одной игры: они начинают гонку
 * за один и тот же ход и могут разместить один тайл несколько раз.
 */
const pendingMoveTimers = new Map<string, NodeJS.Timeout>()
const runningMoveChains = new Set<string>()
const reconnectTimers = new Map<string, NodeJS.Timeout>()

function hasDisconnectedHuman(game: IGameBoard): boolean {
  return game.players.some(
    (player) => Boolean(player.deviceId) && !player.socketId
  )
}

export function cancelComputerMove(gameId: string): void {
  const timer = pendingMoveTimers.get(gameId)
  if (timer) clearTimeout(timer)
  pendingMoveTimers.delete(gameId)
}

export function cancelAllComputerMoves(gameIds: string[]): void {
  gameIds.forEach(cancelComputerMove)
}

/** Запускает ход компьютера с небольшой задержкой */
export function scheduleComputerMove(
  io: Server,
  service: GameService,
  gameId: string,
  delay = COMPUTER_MOVE_DELAY_MS
): void {
  if (pendingMoveTimers.has(gameId) || runningMoveChains.has(gameId)) return

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
    continueComputerGame(io, service, gameId)
  }
}

/** Проигрывает ходы компьютера подряд, пока очередь не перейдёт человеку */
export async function runComputerMoves(
  io: Server,
  service: GameService,
  gameId: string
): Promise<void> {
  if (runningMoveChains.has(gameId)) return
  const game = service.getGame(gameId)
  if (!game || game.gameIsEnded || !game.currentPlayer) return
  if (!isComputerPlayer(game.currentPlayer)) return
  if (hasDisconnectedHuman(game)) {
    continueComputerGame(io, service, gameId)
    return
  }

  runningMoveChains.add(gameId)
  let failed = false
  try {
    await processComputerMoves(io, service, gameId)
  } catch (error) {
    failed = true
    console.error('Failed to continue computer game:', error)
    deleteComputerGame(io, service, gameId, 'move failed')
  } finally {
    runningMoveChains.delete(gameId)
    const currentGame = service.getGame(gameId)
    if (
      !failed &&
      currentGame?.currentPlayer &&
      isComputerPlayer(currentGame.currentPlayer) &&
      !currentGame.gameIsEnded &&
      !pendingMoveTimers.has(gameId)
    ) {
      continueComputerGame(io, service, gameId)
    }
  }
}

async function processComputerMoves(
  io: Server,
  service: GameService,
  gameId: string
): Promise<void> {
  const game = service.getGame(gameId)
  if (!game || game.gameIsEnded || !game.currentPlayer) return
  if (hasDisconnectedHuman(game)) {
    continueComputerGame(io, service, gameId)
    return
  }
  const activePlayerId: PlayerId = game.currentPlayer.id
  const previousState = game.clone()
  const previousTileCount = countPlacedTiles(game)

  try {
    await game.autoPlaceTile()

    const updatedGame = service.getGame(gameId)
    if (!updatedGame) return
    if (hasDisconnectedHuman(updatedGame)) {
      updatedGame.copyStateFrom(previousState)
      continueComputerGame(io, service, gameId)
      return
    }
    if (
      !updatedGame.gameIsEnded &&
      countPlacedTiles(updatedGame) === previousTileCount
    ) {
      throw new Error('Computer move did not place a tile or end the game')
    }

    if (updatedGame.gameIsEnded) {
      await service.saveGame(gameId)
      io.to(gameId).emit('gameUpdated', service.formatGameData(updatedGame))
      io.emit('updateGamesList', service.formatGamesList())
      return
    }

    await service.saveGame(gameId)
    io.to(gameId).emit('gameUpdated', service.formatGameData(updatedGame))

    const nextPlayer = updatedGame.getNextPlayer(activePlayerId)
    if (nextPlayer && isComputerPlayer(nextPlayer)) {
      await sleep(COMPUTER_MOVE_DELAY_MS)
      await processComputerMoves(io, service, gameId)
    }
  } catch (error) {
    game.copyStateFrom(previousState)
    io.to(gameId).emit('gameError', {
      message: 'Error processing computer move',
    })
    throw error
  }
}

function countPlacedTiles(game: IGameBoard): number {
  return Object.values(game.tilePlacesStats).reduce(
    (count, row) => count + Object.keys(row).length,
    0
  )
}
