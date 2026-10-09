import { describe, expect, it } from 'vitest'
import { groupActionsHistory } from '@/components/GameActionsHistory/internal/historyGroups'
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
 * Группировка истории по ходам: записи одного хода попадают под общий
 * заголовок, начисления по итогам партии — в отдельную группу.
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

const tileAction = (moveNumber: number): GameAction => ({
  actionType: ActionTypes.PLACE_TILE,
  actionData: { tile, rowIndex: 15, tileIndex: 16 },
  moveNumber,
})

const scoresAction = (moveNumber: number): GameAction => ({
  actionType: ActionTypes.ADDING_SCORES,
  actionData: {
    objectType: ObjectTypes.ROAD,
    objectData,
    score: { total: 4, players: { 1: 4 } },
  },
  moveNumber,
})

const finalScoresAction: GameAction = {
  actionType: ActionTypes.ADDING_SCORES,
  actionData: {
    objectType: ObjectTypes.ROAD,
    objectData,
    score: { total: 2, players: { 1: 2 } },
    isFinalScoring: true,
  },
  moveNumber: 12,
}

describe('Группировка истории по ходам', () => {
  it('объединяет записи одного хода под один заголовок', () => {
    const groups = groupActionsHistory([
      tileAction(1),
      scoresAction(1),
      tileAction(2),
      tileAction(2),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]?.moveNumber).toBe(1)
    expect(groups[0]?.actions).toHaveLength(2)
    expect(groups[1]?.moveNumber).toBe(2)
    expect(groups[1]?.actions).toHaveLength(2)
  })

  it('выносит финальный подсчёт в отдельную группу без номера хода', () => {
    const groups = groupActionsHistory([
      tileAction(1),
      scoresAction(1),
      tileAction(2),
      finalScoresAction,
      finalScoresAction,
    ])

    expect(groups).toHaveLength(3)
    expect(groups[2]?.isFinalScoring).toBe(true)
    expect(groups[2]?.moveNumber).toBeNull()
    expect(groups[2]?.actions).toHaveLength(2)
    expect(groups.slice(0, 2).every((group) => !group.isFinalScoring)).toBe(
      true
    )
  })

  it('собирает записи без номера хода в один блок без заголовка', () => {
    const unnumbered: GameAction = {
      actionType: ActionTypes.PLACE_TILE,
      actionData: { tile, rowIndex: 1, tileIndex: 1 },
    }
    const groups = groupActionsHistory([unnumbered, unnumbered])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.moveNumber).toBeNull()
    expect(groups[0]?.isFinalScoring).toBe(false)
    expect(groups[0]?.actions).toHaveLength(2)
  })

  it('не смешивает записи без номера хода с нумерованными', () => {
    const unnumbered: GameAction = {
      actionType: ActionTypes.PLACE_TILE,
      actionData: { tile, rowIndex: 1, tileIndex: 1 },
    }
    const groups = groupActionsHistory([unnumbered, tileAction(3)])

    expect(groups).toHaveLength(2)
    expect(groups[0]?.moveNumber).toBeNull()
    expect(groups[1]?.moveNumber).toBe(3)
  })

  it('возвращает пустой список для пустой истории', () => {
    expect(groupActionsHistory([])).toEqual([])
  })
})
