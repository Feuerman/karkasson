import { describe, expect, it } from 'vitest'
import { groupActionsHistory } from '@/components/GameActionsHistory/internal/historyGroups'
import {
  ActionTypes,
  ObjectTypes,
  SideName,
  TileId,
  TileSideType,
} from '@server/modules/types'
import type { GameAction } from '@server/modules/gameActions'
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

    expect(groups).toEqual([
      {
        turnNumber: 1,
        isFinalScoring: false,
        actions: [tileAction(1), scoresAction(1)],
      },
      {
        turnNumber: 2,
        isFinalScoring: false,
        actions: [tileAction(2), tileAction(2)],
      },
    ])
  })

  it('выносит финальный подсчёт в отдельную группу без номера хода', () => {
    const groups = groupActionsHistory([
      tileAction(1),
      scoresAction(1),
      tileAction(2),
      finalScoresAction,
      finalScoresAction,
    ])

    expect(groups).toEqual([
      {
        turnNumber: 1,
        isFinalScoring: false,
        actions: [tileAction(1), scoresAction(1)],
      },
      {
        turnNumber: 2,
        isFinalScoring: false,
        actions: [tileAction(2)],
      },
      {
        turnNumber: null,
        isFinalScoring: true,
        actions: [finalScoresAction, finalScoresAction],
      },
    ])
  })

  it('собирает записи без номера хода в один блок без заголовка', () => {
    const unnumbered: GameAction = {
      actionType: ActionTypes.PLACE_TILE,
      actionData: { tile, rowIndex: 1, tileIndex: 1 },
    }
    const groups = groupActionsHistory([unnumbered, unnumbered])

    expect(groups).toEqual([
      {
        turnNumber: null,
        isFinalScoring: false,
        actions: [unnumbered, unnumbered],
      },
    ])
  })

  it('не смешивает записи без номера хода с нумерованными', () => {
    const unnumbered: GameAction = {
      actionType: ActionTypes.PLACE_TILE,
      actionData: { tile, rowIndex: 1, tileIndex: 1 },
    }
    const groups = groupActionsHistory([unnumbered, tileAction(3)])

    expect(groups).toEqual([
      {
        turnNumber: null,
        isFinalScoring: false,
        actions: [unnumbered],
      },
      {
        turnNumber: 3,
        isFinalScoring: false,
        actions: [tileAction(3)],
      },
    ])
  })

  it('разделяет ходы разных игроков внутри одного раунда', () => {
    const firstTurn = { ...tileAction(1), turnNumber: 1 }
    const secondTurn = { ...tileAction(1), turnNumber: 2 }

    expect(groupActionsHistory([firstTurn, secondTurn])).toEqual([
      {
        turnNumber: 1,
        isFinalScoring: false,
        actions: [firstTurn],
      },
      {
        turnNumber: 2,
        isFinalScoring: false,
        actions: [secondTurn],
      },
    ])
  })

  it('возвращает пустой список для пустой истории', () => {
    expect(groupActionsHistory([])).toEqual([])
  })
})
