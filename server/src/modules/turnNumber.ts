const normalizePlayersCount = (playersCount: number): number =>
  Math.max(1, Math.trunc(playersCount))

const normalizeIndex = (index: number | undefined, players: number): number =>
  Math.min(players - 1, Math.max(0, Math.trunc(index ?? 0)))

export const getPlayerTurnNumber = (
  moveCounter: number | undefined,
  currentPlayerIndex: number | undefined,
  playersCount: number
): number => {
  const players = normalizePlayersCount(playersCount)
  const move = Math.max(1, Math.trunc(moveCounter ?? 1))
  const index = normalizeIndex(currentPlayerIndex, players)

  return (move - 1) * players + index + 1
}

/**
 * Ходы дракона разыгрываются по очереди игроков, но относятся к ходу того,
 * кто поставил вулкан. Его индекс — предыдущий перед `resumePlayerIndex`.
 * Если вулкан поставил последний игрок раунда, `moveCounter` уже увеличен.
 */
export const getDragonTurnNumber = (
  moveCounter: number | undefined,
  resumePlayerIndex: number | undefined,
  playersCount: number
): number => {
  const players = normalizePlayersCount(playersCount)
  const resume = normalizeIndex(resumePlayerIndex, players)
  const placerIndex = (resume - 1 + players) % players
  const move = Math.max(1, Math.trunc(moveCounter ?? 1))
  const round = resume === 0 ? Math.max(1, move - 1) : move

  return (round - 1) * players + placerIndex + 1
}
