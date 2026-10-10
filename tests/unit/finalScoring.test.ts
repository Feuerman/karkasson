import { describe, expect, it } from 'vitest'
import { GameManager } from '@server/modules/GameManager'
import { ActionTypes, ObjectTypes } from '@server/modules/types'
import type { BaseObject, GridTile } from '@server/modules/types'
import { gridTile, makePlayers } from '../helpers/fixtures'

const players = makePlayers().map((player) => ({
  ...player,
  socketId: null,
  deviceId: null,
}))

function tile(x: number, y: number, withShield = false): GridTile {
  return gridTile({ x, y, withShield, id: `${x}-${y}` })
}

function object(
  id: string,
  points: BaseObject['points'],
  playerIds: number[],
  flags: Pick<BaseObject, 'isMonastery' | 'isGarden'> = {}
): BaseObject {
  return {
    id,
    points,
    followers: playerIds.map((playerId) => ({
      playerId,
      objectId: id,
      point: points[0] ?? { x: 0, y: 0 },
    })),
    ...flags,
  }
}

describe('Финальный подсчёт очков', () => {
  it('оценивает незавершённые дороги, города, монастыри и сады один раз', () => {
    const game = new GameManager({ players, finalScoringEnabled: true })
    game.tilePlacesStats = {
      10: {
        10: tile(10, 10),
        11: tile(11, 10),
      },
      20: {
        20: tile(20, 20, true),
      },
      29: {
        29: tile(29, 29),
      },
    }

    game.temporaryObjects.roads = [
      object(
        ObjectTypes.ROAD,
        [
          { x: 10, y: 10 },
          { x: 11, y: 10 },
        ],
        [1]
      ),
    ]
    game.temporaryObjects.cities = [
      object(ObjectTypes.CITY, [{ x: 20, y: 20 }], [1, 2]),
    ]
    game.temporaryObjects.monasteries = [
      object(ObjectTypes.MONASTERY, [{ x: 29, y: 29 }], [2], {
        isMonastery: true,
      }),
    ]
    game.temporaryObjects.gardens = [
      object(ObjectTypes.GARDEN, [{ x: 20, y: 20 }], [1], { isGarden: true }),
    ]
    game.tilesList = []

    game.getRandomTileFromList()

    expect(game.gameIsEnded).toBe(true)
    expect(game.currentPlayer).toBeNull()
    expect(game.scores).toEqual({ 1: 5, 2: 3 })
    expect(game.temporaryObjects).toEqual({
      roads: [],
      cities: [],
      monasteries: [],
      gardens: [],
    })
    expect(game.completedObjects.roads[0]?.score?.total).toBe(2)
    expect(game.completedObjects.cities[0]?.score?.players).toEqual({
      1: 2,
      2: 2,
    })
    expect(game.completedObjects.monasteries[0]?.score?.total).toBe(1)
    expect(game.completedObjects.gardens[0]?.score?.total).toBe(1)
    const scoringActions = game.actionsHistory.filter(
      (action) => action.actionType === ActionTypes.ADDING_SCORES
    )
    expect(scoringActions).toHaveLength(4)
    // Интерфейс выделяет эти начисления отдельным блоком, поэтому все
    // записи финального подсчёта должны быть помечены.
    expect(
      scoringActions.every(
        (action) => action.actionData.isFinalScoring === true
      )
    ).toBe(true)

    game.getRandomTileFromList()
    expect(game.scores).toEqual({ 1: 5, 2: 3 })
  })

  it('не начисляет очки в конце, если опция отключена', () => {
    const game = new GameManager({ players })
    game.temporaryObjects.roads = [
      object(ObjectTypes.ROAD, [{ x: 10, y: 10 }], [1]),
    ]
    game.tilesList = []

    game.getRandomTileFromList()

    expect(game.gameIsEnded).toBe(true)
    expect(game.scores).toEqual({ 1: 0, 2: 0 })
    expect(game.temporaryObjects.roads).toHaveLength(1)
  })

  it('начисляет аббату очки за завершённый объект и не удваивает за незавершённый', () => {
    const game = new GameManager({ players, finalScoringEnabled: true })
    game.tilePlacesStats = { 10: { 10: tile(10, 10) } }
    const completedMonastery = object(
      'completed-monastery',
      [{ x: 10, y: 10 }],
      [1],
      { isMonastery: true }
    )
    const unfinishedMonastery = object(
      'unfinished-monastery',
      [{ x: 10, y: 10 }],
      [1],
      { isMonastery: true }
    )
    const completedAbbot = completedMonastery.followers[0]
    const unfinishedAbbot = unfinishedMonastery.followers[0]
    if (!completedAbbot || !unfinishedAbbot) {
      throw new Error('Expected monastery abbots')
    }
    completedAbbot.isAbbot = true
    unfinishedAbbot.isAbbot = true
    game.completedObjects.monasteries = [completedMonastery]
    game.temporaryObjects.monasteries = [unfinishedMonastery]
    game.tilesList = []

    game.getRandomTileFromList()

    expect(game.scores[1]).toBe(2)
    expect(game.completedObjects.monasteries[0]?.score?.total).toBe(1)
    expect(game.completedObjects.monasteries[1]?.score?.total).toBe(1)
  })
})
