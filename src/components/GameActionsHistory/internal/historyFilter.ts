import { ActionTypes } from '@server/modules/types'
import type { GameAction } from '@server/modules/gameActions'
import { t } from '@/utils/i18n'

/** Фильтр истории по типу действия. */
export const HistoryFilters = {
  ALL: 'ALL',
  TILE: 'TILE',
  FOLLOWER: 'FOLLOWER',
  SCORES: 'SCORES',
  RETURN: 'RETURN',
  DRAGON: 'DRAGON',
  PRINCESS: 'PRINCESS',
  FAIRY: 'FAIRY',
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
  [HistoryFilters.FAIRY]: [ActionTypes.MOVE_FAIRY, ActionTypes.FAIRY_POINT],
}

/** Пункты фильтра в порядке отображения. */
export const HISTORY_FILTERS: ReadonlyArray<{
  value: HistoryFilter
  label: string
  icon: string
}> = [
  {
    value: HistoryFilters.ALL,
    get label() {
      return t('history_filter_all')
    },
    icon: 'i-lucide-list',
  },
  {
    value: HistoryFilters.TILE,
    get label() {
      return t('history_filter_tiles')
    },
    icon: 'i-lucide-layout-grid',
  },
  {
    value: HistoryFilters.FOLLOWER,
    get label() {
      return t('history_filter_followers')
    },
    icon: 'i-lucide-person-standing',
  },
  {
    value: HistoryFilters.SCORES,
    get label() {
      return t('history_filter_scores')
    },
    icon: 'i-lucide-coins',
  },
  {
    value: HistoryFilters.RETURN,
    get label() {
      return t('history_filter_returns')
    },
    icon: 'i-lucide-rotate-ccw',
  },
  {
    value: HistoryFilters.DRAGON,
    get label() {
      return t('history_filter_dragon')
    },
    icon: 'i-lucide-flame',
  },
  {
    value: HistoryFilters.PRINCESS,
    get label() {
      return t('history_filter_princess')
    },
    icon: 'i-lucide-crown',
  },
  {
    value: HistoryFilters.FAIRY,
    get label() {
      return t('history_filter_fairy')
    },
    icon: 'i-lucide-sparkles',
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
