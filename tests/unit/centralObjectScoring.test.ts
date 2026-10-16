import { describe, expect, it } from 'vitest'
import { GameManager } from '@server/modules/GameManager'
import { GameObjectManager } from '@server/modules/GameObjectManager'
import { ActionTypes, ObjectTypes, PointDirection } from '@server/modules/types'
import type { BaseObject, Point } from '@server/modules/types'
import { boardOf, follower, makePlayers } from '../helpers/fixtures'

const players = makePlayers().slice(0, 1)

function completedNeighborhood(point: Point) {
  const tiles: Array<[number, number, { id: string }]> = []

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      tiles.push([
        point.y + dy,
        point.x + dx,
        { id: `tile-${point.x + dx}-${point.y + dy}` },
      ])
    }
  }

  return boardOf(tiles)
}

describe('Начисление очков за завершённые центральные объекты', () => {
  it.each([
    ['монастыря', ObjectTypes.MONASTERY, 'monasteries'],
    ['сада', ObjectTypes.GARDEN, 'gardens'],
  ] as const)(
    'начисляет очки и возвращает подданного с %s',
    (_, objectType, collection) => {
      const game = new GameManager({ players })
      const point = {
        x: 15,
        y: 15,
        direction: PointDirection.Center,
      }
      const objectId = 'central-object'
      const objectFollower = follower(1, objectId, point)
      const object: BaseObject = {
        id: objectId,
        points: [point],
        followers: [objectFollower],
      }

      game.playersFollowers[1].ordinaryFollowers = 6
      game.placedFollowers.push({
        playerId: objectFollower.playerId,
        objectId: objectFollower.objectId,
        point: objectFollower.point,
      })
      game.temporaryObjects[collection].push(object)
      // Все девять клеток вокруг заняты, поэтому объект завершается.
      game.tilePlacesStats = completedNeighborhood(point)

      new GameObjectManager(game).checkCompletedCentralObjects(objectType)

      expect(game.scores[1]).toBe(9)
      expect(game.playersFollowers[1].ordinaryFollowers).toBe(7)
      expect(game.placedFollowers).toHaveLength(0)
      const scoreActions = game.actionsHistory.filter(
        (action) => action.actionType === ActionTypes.ADDING_SCORES
      )
      const returnActions = game.actionsHistory.filter(
        (action) => action.actionType === ActionTypes.BACK_FOLLOWER
      )
      expect(
        scoreActions.map((action) => action.actionData.objectType)
      ).toEqual([objectType])
      expect(
        returnActions.flatMap((action) => action.actionData.followers)
      ).toEqual([{ ...objectFollower, objectType }])
    }
  )
})
