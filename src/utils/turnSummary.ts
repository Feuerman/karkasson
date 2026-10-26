import {
  ActionTypes,
  type ObjectTypes,
  type Player,
  type PlayerId,
  type ScoreDetailLine,
  type Tile,
} from '@server/modules/types'
import type { GameAction } from '@server/modules/gameActions'
import { getFollowerPlaceType, type FollowerPlaceType } from './followerPlaces'

export interface TurnScoreChange {
  playerId: PlayerId
  playerName: string
  color: string | null
  points: number
  isOwn: boolean
}

export interface TurnScoreEvent {
  objectType: ObjectTypes
  points: number
  details?: ScoreDetailLine[]
  modifiers?: string[]
}

export interface TurnSummary {
  key: string
  turnNumber: number | null
  playerId: PlayerId | null
  playerName: string
  color: string | null
  isOwn: boolean
  isFinalScoring: boolean
  placedTile: {
    tile: Tile
    rowIndex: number
    tileIndex: number
  } | null
  follower: {
    placeType: FollowerPlaceType
    rowIndex: number
    tileIndex: number
  } | null
  scoreChanges: TurnScoreChange[]
  scoreEvents: TurnScoreEvent[]
  returnedFollowers: number
  dragonMoves: number
  princessTakes: number
  actions: GameAction[]
}

const isFinalScoringAction = (
  action: GameAction
): action is Extract<GameAction, { actionType: ActionTypes.ADDING_SCORES }> =>
  action.actionType === ActionTypes.ADDING_SCORES &&
  action.actionData.isFinalScoring === true

export const actionTurnKey = (action: GameAction): string => {
  if (isFinalScoringAction(action)) return 'final'
  if (typeof action.turnNumber === 'number') {
    return `turn:${action.turnNumber}`
  }

  const round =
    typeof action.moveNumber === 'number'
      ? `round:${action.moveNumber}`
      : 'unnumbered'
  return `${round}:${String(action.initiator?.id ?? 'none')}`
}

export const buildTurnSummary = (
  actions: GameAction[],
  players: Player[],
  ownPlayerId?: PlayerId | null
): TurnSummary | null => {
  const turnActions = actions.filter(Boolean)
  const firstAction = turnActions[0]
  if (!firstAction) return null

  const playersById = new Map(
    players.map((player) => [String(player.id), player])
  )
  const resolvePlayer = (playerId: PlayerId) => {
    const player = playersById.get(String(playerId))
    return {
      playerId,
      playerName: player?.name || `Игрок ${String(playerId)}`,
      color: player?.color ?? null,
      isOwn: ownPlayerId != null && String(playerId) === String(ownPlayerId),
    }
  }

  const isFinalScoring = isFinalScoringAction(firstAction)
  const initiator = turnActions.find((action) => action.initiator)?.initiator
  const placedTileAction = turnActions.find(
    (action) => action.actionType === ActionTypes.PLACE_TILE
  )
  const followerAction = turnActions.find(
    (action) => action.actionType === ActionTypes.PLACE_FOLLOWER
  )
  const scoreChangesByPlayer = new Map<
    string,
    { playerId: PlayerId; points: number }
  >()
  const scoreEvents: TurnScoreEvent[] = []
  let returnedFollowers = 0
  let dragonMoves = 0
  let princessTakes = 0

  for (const action of turnActions) {
    switch (action.actionType) {
      case ActionTypes.ADDING_SCORES: {
        for (const [playerId, points] of Object.entries(
          action.actionData.score.players ?? {}
        )) {
          if (typeof points !== 'number' || points === 0) continue
          const key = String(playerId)
          const current = scoreChangesByPlayer.get(key)
          const knownPlayer = playersById.get(key)
          scoreChangesByPlayer.set(key, {
            playerId: current?.playerId ?? knownPlayer?.id ?? playerId,
            points: (current?.points ?? 0) + points,
          })
        }

        const eventPoints =
          Object.values(action.actionData.score.players ?? {}).reduce<number>(
            (total, points) => total + (points ?? 0),
            0
          ) || action.actionData.score.total
        if (eventPoints > 0) {
          scoreEvents.push({
            objectType: action.actionData.objectType,
            points: eventPoints,
            details: action.actionData.details,
            modifiers: action.actionData.modifiers,
          })
        }
        break
      }
      case ActionTypes.BACK_FOLLOWER:
        returnedFollowers += action.actionData.followers.length
        break
      case ActionTypes.DRAGON_MOVE:
        dragonMoves += 1
        break
      case ActionTypes.PRINCESS_TAKE_FOLLOWER:
        princessTakes += 1
        break
    }
  }

  const scoreChanges = [...scoreChangesByPlayer.values()]
    .map(({ playerId, points }) => ({
      ...resolvePlayer(playerId),
      points,
    }))
    .sort(
      (left, right) =>
        right.points - left.points ||
        left.playerName.localeCompare(right.playerName, 'ru')
    )

  return {
    key: actionTurnKey(firstAction),
    turnNumber: isFinalScoring ? null : (firstAction.turnNumber ?? null),
    playerId: initiator?.id ?? null,
    playerName: isFinalScoring
      ? 'Финальный подсчёт'
      : initiator?.name || 'Ход игрока',
    color: initiator?.color ?? null,
    isOwn:
      !isFinalScoring &&
      ownPlayerId != null &&
      String(initiator?.id) === String(ownPlayerId),
    isFinalScoring,
    placedTile:
      placedTileAction?.actionType === ActionTypes.PLACE_TILE
        ? {
            tile: placedTileAction.actionData.tile,
            rowIndex: placedTileAction.actionData.rowIndex,
            tileIndex: placedTileAction.actionData.tileIndex,
          }
        : null,
    follower:
      followerAction?.actionType === ActionTypes.PLACE_FOLLOWER
        ? {
            placeType: getFollowerPlaceType(followerAction.actionData),
            rowIndex: followerAction.actionData.point.y,
            tileIndex: followerAction.actionData.point.x,
          }
        : null,
    scoreChanges,
    scoreEvents,
    returnedFollowers,
    dragonMoves,
    princessTakes,
    actions: turnActions,
  }
}
