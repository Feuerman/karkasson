import type {
  DragonPosition,
  FairyFollowerRef,
  FairyState,
  ObjectFollower,
  PlayerId,
  Point,
  ScoreDetailLine,
  ScoreForObject,
  Scores,
} from './types'

/** Очко феи в начале хода владельца связанного подданного. */
export const FAIRY_TURN_POINTS = 1

/** Бонус феи при подсчёте объекта или поля. */
export const FAIRY_SCORING_BONUS = 3

export function fairyFollowerPosition(
  follower: Pick<FairyFollowerRef, 'point'>
): DragonPosition {
  return {
    rowIndex: follower.point.y ?? follower.point.rowIndex ?? 0,
    tileIndex: follower.point.x ?? follower.point.tileIndex ?? 0,
  }
}

export function isSameFairyFollower(
  left: FairyFollowerRef,
  right: FairyFollowerRef
): boolean {
  return (
    String(left.playerId) === String(right.playerId) &&
    left.point.x === right.point.x &&
    left.point.y === right.point.y &&
    left.point.direction === right.point.direction &&
    left.point.regionIndex === right.point.regionIndex &&
    Boolean(left.isAbbot) === Boolean(right.isAbbot) &&
    Boolean(left.isBigFollower) === Boolean(right.isBigFollower)
  )
}

export function fairyFollowerRef(
  follower: Pick<
    ObjectFollower,
    'playerId' | 'point' | 'isAbbot' | 'isBigFollower'
  >
): FairyFollowerRef {
  return {
    playerId: follower.playerId,
    point: { ...follower.point },
    isAbbot: follower.isAbbot,
    isBigFollower: follower.isBigFollower,
  }
}

/** Снимает привязку феи, если с доски уходит именно этот подданный. */
export function clearFairyFollower(
  state: { fairy?: FairyState },
  follower: FairyFollowerRef
): void {
  if (
    state.fairy?.follower &&
    isSameFairyFollower(state.fairy.follower, follower)
  ) {
    state.fairy.follower = undefined
  }
}

/** Есть ли среди подданных объекта тот, к которому привязана фея. */
export function hasLinkedFairyFollower(
  fairy: FairyState | undefined,
  followers: ReadonlyArray<
    Pick<ObjectFollower, 'playerId' | 'point' | 'isAbbot' | 'isBigFollower'>
  >
): FairyFollowerRef | undefined {
  const linked = fairy?.follower
  if (!linked) return undefined
  return followers.some((follower) =>
    isSameFairyFollower(linked, fairyFollowerRef(follower))
  )
    ? linked
    : undefined
}

export function fairyBonusDetail(): ScoreDetailLine {
  return {
    label: 'Бонус феи',
    count: 1,
    pointsPerUnit: FAIRY_SCORING_BONUS,
    total: FAIRY_SCORING_BONUS,
  }
}

/**
 * Начисляет владельцу связанного подданного бонус феи. Вызывается после
 * обычного распределения очков, поэтому бонус получает именно он, а не
 * лидеры объекта.
 */
export function applyFairyBonus(
  fairy: FairyState | undefined,
  followers: ReadonlyArray<{
    playerId: PlayerId
    point: Point
    isAbbot?: boolean
    isBigFollower?: boolean
  }>,
  score: ScoreForObject,
  scores: Scores
): boolean {
  const linked = hasLinkedFairyFollower(fairy, followers)
  if (!linked) return false

  const playerId: PlayerId = linked.playerId
  score.players[playerId] = (score.players[playerId] ?? 0) + FAIRY_SCORING_BONUS
  score.total += FAIRY_SCORING_BONUS
  scores[playerId] = (scores[playerId] ?? 0) + FAIRY_SCORING_BONUS
  return true
}
