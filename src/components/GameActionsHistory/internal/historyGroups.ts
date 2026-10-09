import { ActionTypes } from '@server/modules/types'
import type { GameAction } from '@server/modules/GameManager'

/**
 * Группа записей истории с общим заголовком: записи одного хода либо
 * финальный подсчёт очков по завершении партии.
 */
export interface HistoryGroup {
  /**
   * Номер хода группы. `null` у финального подсчёта и у группы записей без
   * номера хода — такие группы показываются без заголовка с номером.
   */
  moveNumber: number | null
  /** Группа собрана из начислений по итогам партии. */
  isFinalScoring: boolean
  actions: GameAction[]
}

type GroupKey = number | 'final' | 'unnumbered'

const isFinalScoringAction = (
  action: GameAction
): action is Extract<GameAction, { actionType: ActionTypes.ADDING_SCORES }> =>
  action.actionType === ActionTypes.ADDING_SCORES &&
  action.actionData.isFinalScoring === true

/** Ключ, по которому записи попадают в одну группу. */
const groupKeyOf = (action: GameAction): GroupKey => {
  if (isFinalScoringAction(action)) return 'final'
  return action.moveNumber ?? 'unnumbered'
}

/**
 * Группирует записи истории по ходам: записи одного хода объединяются под
 * общий заголовок, начисления по итогам партии выносятся в отдельную группу.
 * Записи без номера хода (сохранения старых версий) собираются в один блок
 * без заголовков.
 */
export const groupActionsHistory = (actions: GameAction[]): HistoryGroup[] => {
  const groups: HistoryGroup[] = []
  let currentKey: GroupKey | undefined

  for (const action of actions) {
    const key = groupKeyOf(action)
    const current = groups[groups.length - 1]
    if (current && key === currentKey) {
      current.actions.push(action)
      continue
    }
    currentKey = key
    groups.push({
      // Финальный подсчёт показывается без номера хода: он не относится
      // к отдельному ходу и идёт после последнего.
      moveNumber: key === 'final' ? null : (action.moveNumber ?? null),
      isFinalScoring: key === 'final',
      actions: [action],
    })
  }

  return groups
}
