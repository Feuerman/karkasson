import {
  getDragonTurnNumber,
  getPlayerTurnNumber,
} from '@server/modules/turnNumber'

interface TurnNumberBoard {
  moveCounter?: number
  currentPlayerIndex?: number
  players?: readonly unknown[]
  dragonMove?: { resumePlayerIndex?: number } | null
}

/**
 * Номер текущего хода для интерфейса. Во время движения дракона очередь
 * переходит между игроками, но все шаги относятся к ходу поставившего вулкан.
 */
export const getCurrentTurnNumber = (gameBoard: TurnNumberBoard): number => {
  const playersCount = gameBoard.players?.length ?? 0
  if (gameBoard.dragonMove) {
    return getDragonTurnNumber(
      gameBoard.moveCounter,
      gameBoard.dragonMove.resumePlayerIndex,
      playersCount
    )
  }
  return getPlayerTurnNumber(
    gameBoard.moveCounter,
    gameBoard.currentPlayerIndex,
    playersCount
  )
}
