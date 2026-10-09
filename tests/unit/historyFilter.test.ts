import { describe, expect, it } from 'vitest'
import {
  countActionsByFilter,
  filterActionsHistory,
  HISTORY_FILTERS,
  HistoryFilters,
  matchesHistoryFilter,
} from '@/components/GameActionsHistory/internal/historyFilter'
import {
  ActionTypes,
  ObjectTypes,
  SideName,
  TileId,
  TileSideType,
} from '@server/modules/types'
import type { GameAction } from '@server/modules/GameManager'
import type { BaseObject, Tile } from '@server/modules/types'

/**
 * Фильтр истории — чистая функция отбора по типу действия, поэтому
 * проверяется без монтирования компонента.
 */

const objectData: BaseObject = { id: 'o1', points: [], followers: [] }

const tile: Tile = {
  id: TileId.T,
  rotation: 0,
  sides: {
    [SideName.North]: TileSideType.Field,
    [SideName.West]: TileSideType.Field,
    [SideName.South]: TileSideType.Field,
    [SideName.East]: TileSideType.Field,
  },
}

const tileAction: GameAction = {
  actionType: ActionTypes.PLACE_TILE,
  actionData: { tile, rowIndex: 15, tileIndex: 16 },
}

const followerAction: GameAction = {
  actionType: ActionTypes.PLACE_FOLLOWER,
  actionData: {
    point: { x: 0, y: 0, pointType: TileSideType.Road },
    temporaryObject: objectData,
  },
}

const scoresAction: GameAction = {
  actionType: ActionTypes.ADDING_SCORES,
  actionData: {
    objectType: ObjectTypes.ROAD,
    objectData,
    score: { total: 4, players: { 1: 4 } },
  },
}

const backAction: GameAction = {
  actionType: ActionTypes.BACK_FOLLOWER,
  actionData: { followers: [] },
}

const dragonAction: GameAction = {
  actionType: ActionTypes.DRAGON_MOVE,
  actionData: {
    from: { rowIndex: 15, tileIndex: 10 },
    to: { rowIndex: 15, tileIndex: 11 },
    eatenFollowers: [],
    remainingSteps: 5,
  },
}

const princessAction: GameAction = {
  actionType: ActionTypes.PRINCESS_TAKE_FOLLOWER,
  actionData: {
    cityId: 'o1',
    takenFollower: {
      playerId: 1,
      objectId: 'o1',
      point: { x: 0, y: 0, direction: SideName.North },
    },
  },
}

const history = [
  tileAction,
  followerAction,
  scoresAction,
  backAction,
  dragonAction,
  princessAction,
]

describe('фильтр истории по типу действия', () => {
  it('«Все» возвращает историю без изменений', () => {
    expect(filterActionsHistory(history, HistoryFilters.ALL)).toEqual(history)
  })

  it('каждый тип показывает только свои действия', () => {
    expect(filterActionsHistory(history, HistoryFilters.TILE)).toEqual([
      tileAction,
    ])
    expect(filterActionsHistory(history, HistoryFilters.FOLLOWER)).toEqual([
      followerAction,
    ])
    expect(filterActionsHistory(history, HistoryFilters.SCORES)).toEqual([
      scoresAction,
    ])
    expect(filterActionsHistory(history, HistoryFilters.RETURN)).toEqual([
      backAction,
    ])
    expect(filterActionsHistory(history, HistoryFilters.DRAGON)).toEqual([
      dragonAction,
    ])
    expect(filterActionsHistory(history, HistoryFilters.PRINCESS)).toEqual([
      princessAction,
    ])
  })

  it('пустая история не ломает отбор', () => {
    for (const { value } of HISTORY_FILTERS) {
      expect(filterActionsHistory([], value)).toEqual([])
    }
  })

  it('счётчики совпадают с результатами отбора', () => {
    const counts = countActionsByFilter(history)
    expect(counts).toEqual({
      ALL: 6,
      TILE: 1,
      FOLLOWER: 1,
      SCORES: 1,
      RETURN: 1,
      DRAGON: 1,
      PRINCESS: 1,
    })
    for (const { value } of HISTORY_FILTERS) {
      expect(filterActionsHistory(history, value)).toHaveLength(counts[value])
    }
  })

  it('счётчики пустой истории нулевые', () => {
    expect(countActionsByFilter([])).toEqual({
      ALL: 0,
      TILE: 0,
      FOLLOWER: 0,
      SCORES: 0,
      RETURN: 0,
      DRAGON: 0,
      PRINCESS: 0,
    })
  })

  it('фильтр «Все» подходит любому действию', () => {
    for (const action of history) {
      expect(matchesHistoryFilter(action, HistoryFilters.ALL)).toBe(true)
    }
  })
})
