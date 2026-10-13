import { describe, expect, it } from 'vitest'
import { GameManager } from '@server/modules/GameManager'
import { GameObjectManager } from '@server/modules/GameObjectManager'
import {
  ActionTypes,
  ObjectTypes,
  PointDirection,
  SideName,
  TileSideType,
} from '@server/modules/types'
import type { BaseObject, ObjectFollower } from '@server/modules/types'
import { makePlayers } from '../helpers/fixtures'

const players = makePlayers().slice(0, 1)

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
      game.temporaryObjects[
        objectType === ObjectTypes.MONASTERY ? 'monasteries' : 'gardens'
      ].push(object)

      // Все девять клеток вокруг заняты, поэтому объект завершается.
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          game.tilePlacesStats[15 + dy] = {
            ...(game.tilePlacesStats[15 + dy] ?? {}),
            [15 + dx]: {
              id: `tile-${15 + dx}-${15 + dy}`,
              rotation: 0,
              x: 15 + dx,
              y: 15 + dy,
              sides: {
                [SideName.North]: TileSideType.Field,
                [SideName.East]: TileSideType.Field,
                [SideName.South]: TileSideType.Field,
                [SideName.West]: TileSideType.Field,
              },
            },
          }
        }
      }

      new GameObjectManager(game).checkCompletedCentralObjects(objectType)

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
