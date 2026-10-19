import type { Player, PlayerId, Scores } from '@server/modules/types'

/** Игрок в таблице счёта: с очками и признаками лидера и «это я». */
export interface RankedPlayer {
  player: Player
  score: number
  /** Лидирует по очкам. */
  isLeader: boolean
  /** За этим игроком сидит текущий браузер. */
  isMe: boolean
}

/** Как текущий браузер узнаёт себя среди игроков. */
export interface OwnPlayerRef {
  socketId?: string | null
  deviceId?: string | null
}

/**
 * Игрок, которого разыгрывает компьютер.
 *
 * Признак тот же, что и на сервере: у компьютера нет ни сокета, ни устройства,
 * поэтому его ход виден как «ход соперника, который думает».
 */
export const isComputerPlayer = (player?: Player | null): boolean => {
  if (!player) return false

  return !player.socketId && !player.deviceId
}

/** Ищет игрока, за которым сидит текущий браузер. */
export const findOwnPlayer = (
  players: Player[],
  own: OwnPlayerRef
): Player | undefined =>
  players.find(
    (player) =>
      (Boolean(own.socketId) && player.socketId === own.socketId) ||
      (Boolean(own.deviceId) && player.deviceId === own.deviceId)
  )

/**
 * Таблица счёта: игроки по убыванию очков.
 *
 * При равном счёте порядок прежний, чтобы игроки не «прыгали» в списке.
 * Лидером считается игрок с наибольшим счётом, если очки уже есть.
 */
export const rankPlayers = (
  players: Player[],
  scores: Scores | undefined,
  ownPlayerId?: PlayerId | null
): RankedPlayer[] => {
  const scoreOf = (player: Player) => scores?.[player.id] ?? 0
  const maxScore = players.reduce(
    (max, player) => Math.max(max, scoreOf(player)),
    0
  )

  return players
    .map((player, index) => ({
      player,
      score: scoreOf(player),
      isLeader: maxScore > 0 && scoreOf(player) === maxScore,
      isMe: ownPlayerId != null && String(player.id) === String(ownPlayerId),
      index,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ player, score, isLeader, isMe }) => ({
      player,
      score,
      isLeader,
      isMe,
    }))
}

/**
 * Следующий по кругу игрок.
 *
 * Порядок ходов задаёт сервер: игроки ходят по порядку в списке.
 */
export const getNextPlayer = (
  players: Player[],
  currentPlayerIndex: number
): Player | undefined => {
  if (players.length === 0) return undefined

  return players[(currentPlayerIndex + 1) % players.length]
}
