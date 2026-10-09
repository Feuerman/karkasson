import { describe, expect, it } from 'vitest'
import { GameManager } from '@server/modules/GameManager'
import { ActionTypes, ObjectTypes, PointDirection } from '@server/modules/types'
import type { BaseObject, ObjectFollower, Player } from '@server/modules/types'

const players: Player[] = [
  {
    id: 1,
    name: 'Alice',
    color: 'coral',
    score: 0,
    socketId: 'socket-1',
    deviceId: 'device-1',
  },
]

describe('Начисление очков за завершённые центральные объекты', () => {
  it.each([
    ['монастыря', ObjectTypes.MONASTERY],
    ['сада', ObjectTypes.GARDEN],
  ] as const)(
    'начисляет очки и возвращает подданного с %s',
    (_, objectType) => {
      const game = new GameManager({ players })
      const point = {
        x: 15,
        y: 15,
        direction: PointDirection.Center,
      }
      const follower: ObjectFollower = {
        playerId: 1,
        objectId: 'central-object',
        point,
      }
      const object: BaseObject = {
        id: follower.objectId,
        points: [point],
        followers: [follower],
      }

      game.playersFollowers[1].ordinaryFollowers = 6
      game.placedFollowers.push({
        playerId: follower.playerId,
        objectId: follower.objectId,
        point: follower.point,
      })

      if (objectType === ObjectTypes.MONASTERY) {
        game.calcScoreForMonasteries([object])
      } else {
        game.calcScoreForGardens([object])
      }

      expect(game.scores[1]).toBe(9)
      expect(game.playersFollowers[1].ordinaryFollowers).toBe(7)
      expect(game.placedFollowers).toHaveLength(0)
      expect(
        game.actionsHistory
          .filter((action) => action.actionType === ActionTypes.ADDING_SCORES)
          .map((action) => action.actionData.objectType)
      ).toEqual([objectType])
      expect(
        game.actionsHistory
          .filter((action) => action.actionType === ActionTypes.BACK_FOLLOWER)
          .flatMap((action) => action.actionData.followers)
      ).toEqual([{ ...follower, objectType }])
    }
  )
})
