import type { GameAction } from '@server/modules/gameActions'
import { actionTurnKey } from '@/utils/turnSummary'

export interface HistoryGroup {
  turnNumber: number | null
  isFinalScoring: boolean
  actions: GameAction[]
}

export const groupActionsHistory = (actions: GameAction[]): HistoryGroup[] => {
  const groups: HistoryGroup[] = []
  let currentKey: string | undefined

  for (const action of actions) {
    const key = actionTurnKey(action)
    const current = groups[groups.length - 1]
    if (current && key === currentKey) {
      current.actions.push(action)
      continue
    }
    currentKey = key
    groups.push({
      turnNumber:
        key === 'final'
          ? null
          : (action.turnNumber ?? action.moveNumber ?? null),
      isFinalScoring: key === 'final',
      actions: [action],
    })
  }

  return groups
}
