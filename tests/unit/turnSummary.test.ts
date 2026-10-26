import { describe, expect, it } from 'vitest'
import {
  ActionTypes,
  ObjectTypes,
  PointDirection,
  SideName,
  TileId,
  TileSideType,
} from '@server/modules/types'
import type { GameAction } from '@server/modules/gameActions'
import type { BaseObject, Player, Tile } from '@server/modules/types'
import { makePlayers } from '../helpers/fixtures'
import { actionTurnKey, buildTurnSummary } from '@/utils/turnSummary'

const players: Player[] = makePlayers()
const tile: Tile = {
  id: TileId.T,
  rotation: 0,
  sides: {
    [SideName.North]: TileSideType.City,
    [SideName.East]: TileSideType.Field,
    [SideName.South]: TileSideType.Field,
    [SideName.West]: TileSideType.Field,
  },
}
const objectData: BaseObject = {
  id: 'city-1',
  points: [],
  followers: [],
}

const tileAction: GameAction = {
  actionType: ActionTypes.PLACE_TILE,
  actionData: { tile, rowIndex: 15, tileIndex: 16 },
  initiator: players[0],
  moveNumber: 1,
  turnNumber: 2,
}

const followerAction: GameAction = {
  actionType: ActionTypes.PLACE_FOLLOWER,
  actionData: {
    point: {
      x: 16,
      y: 15,
      direction: PointDirection.North,
      pointType: TileSideType.City,
    },
    temporaryObject: objectData,
  },
  initiator: players[0],
  moveNumber: 1,
  turnNumber: 2,
}

const scoreAction: Extract<
  GameAction,
  { actionType: ActionTypes.ADDING_SCORES }
> = {
  actionType: ActionTypes.ADDING_SCORES,
  actionData: {
    objectType: ObjectTypes.CITY,
    objectData,
    score: { total: 6, players: { 1: 6, 2: 0 } },
    details: [{ label: 'Город', count: 1, pointsPerUnit: 6, total: 6 }],
    modifiers: ['Собор'],
  },
  initiator: players[0],
  moveNumber: 1,
  turnNumber: 2,
}

const backFollowerAction: GameAction = {
  actionType: ActionTypes.BACK_FOLLOWER,
  actionData: {
    followers: [
      {
        playerId: 1,
        objectId: 'city-1',
        point: { x: 16, y: 15 },
        objectType: ObjectTypes.CITY,
      },
    ],
  },
  initiator: players[0],
  moveNumber: 1,
  turnNumber: 2,
}

const dragonAction: GameAction = {
  actionType: ActionTypes.DRAGON_MOVE,
  actionData: {
    from: { rowIndex: 14, tileIndex: 15 },
    to: { rowIndex: 14, tileIndex: 16 },
    eatenFollowers: [],
    remainingSteps: 5,
  },
  initiator: players[0],
  moveNumber: 1,
  turnNumber: 2,
}

const princessAction: GameAction = {
  actionType: ActionTypes.PRINCESS_TAKE_FOLLOWER,
  actionData: {
    cityId: 'city-1',
    takenFollower: {
      playerId: 2,
      objectId: 'city-1',
      point: { x: 16, y: 15 },
    },
  },
  initiator: players[0],
  moveNumber: 1,
  turnNumber: 2,
}

describe('buildTurnSummary', () => {
  it('собирает действия хода, очки и счётчики событий', () => {
    const summary = buildTurnSummary(
      [
        tileAction,
        followerAction,
        scoreAction,
        backFollowerAction,
        dragonAction,
        princessAction,
      ],
      players,
      1
    )

    expect(summary).toMatchObject({
      key: 'turn:2',
      turnNumber: 2,
      playerId: 1,
      playerName: 'Alice',
      color: 'coral',
      isOwn: true,
      isFinalScoring: false,
      placedTile: {
        tile,
        rowIndex: 15,
        tileIndex: 16,
      },
      follower: {
        placeType: TileSideType.City,
        rowIndex: 15,
        tileIndex: 16,
      },
      scoreChanges: [
        {
          playerId: 1,
          playerName: 'Alice',
          color: 'coral',
          points: 6,
          isOwn: true,
        },
      ],
      returnedFollowers: 1,
      dragonMoves: 1,
      princessTakes: 1,
    })
    expect(summary?.scoreEvents).toEqual([
      {
        objectType: ObjectTypes.CITY,
        points: 6,
        details: [{ label: 'Город', count: 1, pointsPerUnit: 6, total: 6 }],
        modifiers: ['Собор'],
      },
    ])
  })

  it('отмечает чужой ход и не приписывает его зрителю', () => {
    const summary = buildTurnSummary([scoreAction], players, 2)

    expect(summary?.isOwn).toBe(false)
    expect(summary?.scoreChanges[0]).toMatchObject({
      playerId: 1,
      playerName: 'Alice',
      isOwn: false,
    })
  })

  it('выделяет финальный подсчёт в отдельную сводку', () => {
    const finalAction: GameAction = {
      ...scoreAction,
      actionData: {
        ...scoreAction.actionData,
        isFinalScoring: true,
      },
    }

    const summary = buildTurnSummary([finalAction], players, 1)

    expect(summary).toMatchObject({
      key: 'final',
      turnNumber: null,
      isFinalScoring: true,
      playerName: 'Финальный подсчёт',
      isOwn: false,
    })
  })

  it('поддерживает старые записи без номера хода игрока', () => {
    const oldAction: GameAction = {
      actionType: ActionTypes.PLACE_TILE,
      actionData: { tile, rowIndex: 15, tileIndex: 16 },
      initiator: players[1],
      moveNumber: 4,
    }

    expect(actionTurnKey(oldAction)).toBe('round:4:2')
    expect(buildTurnSummary([oldAction], players, 1)).toMatchObject({
      key: 'round:4:2',
      turnNumber: null,
      playerName: 'Bob',
      isOwn: false,
    })
  })

  it('возвращает null для пустой истории', () => {
    expect(buildTurnSummary([], players, 1)).toBeNull()
  })
})
