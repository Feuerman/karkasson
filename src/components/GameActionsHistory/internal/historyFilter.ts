import { ActionTypes } from '@server/modules/types'
import type { GameAction } from '@server/modules/GameManager'

/** Фильтр истории по типу действия. */
export const HistoryFilters = {
  ALL: 'ALL',
  TILE: 'TILE',
  FOLLOWER: 'FOLLOWER',
  SCORES: 'SCORES',
  RETURN: 'RETURN',
  DRAGON: 'DRAGON',
  PRINCESS: 'PRINCESS',
} as const

export type HistoryFilter = (typeof HistoryFilters)[keyof typeof HistoryFilters]

const FILTER_BY_ACTION_TYPE: Record<
  HistoryFilter,
  readonly ActionTypes[] | 'ALL'
> = {
  [HistoryFilters.ALL]: 'ALL',
  [HistoryFilters.TILE]: [ActionTypes.PLACE_TILE],
  [HistoryFilters.FOLLOWER]: [ActionTypes.PLACE_FOLLOWER],
  [HistoryFilters.SCORES]: [ActionTypes.ADDING_SCORES],
  [HistoryFilters.RETURN]: [ActionTypes.BACK_FOLLOWER],
  [HistoryFilters.DRAGON]: [ActionTypes.DRAGON_MOVE],
  [HistoryFilters.PRINCESS]: [ActionTypes.PRINCESS_TAKE_FOLLOWER],
}

/** Пункты фильтра в порядке отображения. */
export const HISTORY_FILTERS: ReadonlyArray<{
  value: HistoryFilter
  label: string
  icon: string
}> = [
  { value: HistoryFilters.ALL, label: 'Все', icon: 'i-lucide-list' },
  { value: HistoryFilters.TILE, label: 'Тайлы', icon: 'i-lucide-layout-grid' },
  {
    value: HistoryFilters.FOLLOWER,
    label: 'Подданные',
    icon: 'i-lucide-person-standing',
  },
  { value: HistoryFilters.SCORES, label: 'Очки', icon: 'i-lucide-coins' },
  {
    value: HistoryFilters.RETURN,
    label: 'Возвраты',
    icon: 'i-lucide-rotate-ccw',
  },
  { value: HistoryFilters.DRAGON, label: 'Дракон', icon: 'i-lucide-flame' },
  {
    value: HistoryFilters.PRINCESS,
    label: 'Принцесса',
    icon: 'i-lucide-crown',
  },
]

export const matchesHistoryFilter = (
  action: GameAction,
  filter: HistoryFilter
): boolean => {
  const allowed = FILTER_BY_ACTION_TYPE[filter]
  return allowed === 'ALL' || allowed.includes(action.actionType)
}

export const filterActionsHistory = (
  actions: GameAction[],
  filter: HistoryFilter
): GameAction[] =>
  filter === HistoryFilters.ALL
    ? actions
    : actions.filter((action) => matchesHistoryFilter(action, filter))

/** Сколько действий попадёт под каждый фильтр — для счётчиков на кнопках. */
export const countActionsByFilter = (
  actions: GameAction[]
): Record<HistoryFilter, number> => {
  const counts = Object.fromEntries(
    HISTORY_FILTERS.map(({ value }) => [value, 0])
  ) as Record<HistoryFilter, number>

  for (const action of actions) {
    counts[HistoryFilters.ALL] += 1
    for (const { value } of HISTORY_FILTERS) {
      if (value === HistoryFilters.ALL) continue
      if (matchesHistoryFilter(action, value)) counts[value] += 1
    }
  }

  return counts
}
