import { describe, expect, it } from 'vitest'
import { GameManager } from '../../server/src/modules/GameManager'
import { ActionTypes, ObjectTypes } from '../../server/src/modules/types'
import type {
  BaseObject,
  GridTile,
  ObjectFollower,
  Player,
  Point,
  TileSideType,
} from '../../server/src/modules/types'

const players: Player[] = [
  {
    id: 1,
    name: 'Alice',
    color: 'coral',
    score: 0,
    socketId: 'socket-1',
    deviceId: 'device-1',
  },
  {
    id: 2,
    name: 'Bob',
    color: 'skyblue',
    score: 0,
    socketId: 'socket-2',
    deviceId: 'device-2',
  },
]

function gridTile(x: number, withShield = false): GridTile {
  return {
    id: `tile-${x}`,
    rotation: 0,
    x,
    y: 15,
    sides: { north: 'field', east: 'field', south: 'field', west: 'field' },
    withShield,
  }
}

function segment(id: string, point: Point, playerId: number): BaseObject {
  const follower: ObjectFollower = {
    playerId,
    objectId: id,
    point,
  }
  return { id, points: [point], followers: [follower] }
}

describe('Слияние и завершение дорог и городов', () => {
  it('объединяет несколько сегментов города, связанных на одном тайле', () => {
    const game = new GameManager({ players })
    const segments = [
      {
        id: 'city-north',
        playerId: 1,
        connectedPoint: { x: 15, y: 14, direction: 'south' as const },
        openPoint: { x: 15, y: 14, direction: 'north' as const },
      },
      {
        id: 'city-east',
        playerId: 2,
        connectedPoint: { x: 16, y: 15, direction: 'west' as const },
        openPoint: { x: 16, y: 15, direction: 'east' as const },
      },
      {
        id: 'city-west',
        playerId: 1,
        connectedPoint: { x: 14, y: 15, direction: 'east' as const },
        openPoint: { x: 14, y: 15, direction: 'west' as const },
      },
    ]
    game.tilePlacesStats = {
      14: { 15: gridTile(15) },
      15: {
        14: gridTile(14),
        16: gridTile(16),
        15: {
          id: 'bridge-city',
          rotation: 0,
          x: 15,
          y: 15,
          sides: { north: 'city', east: 'city', south: 'field', west: 'city' },
          cityGroups: [['north', 'east', 'west']],
        },
      },
    }
    game.temporaryObjects.cities = segments.map(
      ({ id, playerId, connectedPoint, openPoint }) => {
        const connected: Point = { ...connectedPoint, pointType: 'city' }
        const open: Point = { ...openPoint, pointType: 'city' }
        const object = segment(id, connected, playerId)
        object.points.push(open)
        return object
      }
    )
    for (const city of game.temporaryObjects.cities) {
      const cityFollower = city.followers[0]
      if (!cityFollower) continue
      game.placedFollowers.push({
        playerId: cityFollower.playerId,
        objectId: city.id,
        point: cityFollower.point,
      })
    }

    game.checkGridAfterPlacingTile(15, 15)

    expect(game.temporaryObjects.cities).toHaveLength(1)
    expect(game.completedObjects.cities).toHaveLength(0)
    const [mergedCity] = game.temporaryObjects.cities
    expect(mergedCity?.followers).toHaveLength(3)
    if (!mergedCity) return
    expect(
      mergedCity.followers.every(({ objectId }) => objectId === mergedCity.id)
    ).toBe(true)
    expect(game.placedFollowers.map(({ objectId }) => objectId)).toEqual([
      mergedCity.id,
      mergedCity.id,
      mergedCity.id,
    ])
  })

  it('начисляет герб завершённого города при слиянии сегментов', () => {
    const game = new GameManager({ players })
    const leftPoint: Point = {
      x: 14,
      y: 15,
      direction: 'east',
      pointType: 'city',
    }
    const rightPoint: Point = {
      x: 16,
      y: 15,
      direction: 'west',
      pointType: 'city',
    }
    const leftCity = segment('shield-city-left', leftPoint, 1)
    const rightCity = segment('shield-city-right', rightPoint, 1)
    leftCity.points.push({
      x: 14,
      y: 15,
      direction: 'north',
      pointType: 'city',
    })
    game.temporaryObjects.cities = [leftCity, rightCity]
    game.tilePlacesStats = {
      15: {
        14: gridTile(14),
        15: gridTile(15, true),
        16: gridTile(16),
      },
      14: { 14: { ...gridTile(14), y: 14 } },
    }
    game.playersFollowers[1].ordinaryFollowers = 5
    game.placedFollowers.push({
      playerId: 1,
      objectId: leftCity.id,
      point: leftPoint,
    })
    game.placedFollowers.push({
      playerId: 1,
      objectId: rightCity.id,
      point: rightPoint,
    })

    game.mergeCities(
      [leftCity.id, rightCity.id],
      [
        { x: 15, y: 15, direction: 'west', pointType: 'city' },
        { x: 15, y: 15, direction: 'east', pointType: 'city' },
        { x: 14, y: 14, direction: 'south', pointType: 'city' },
      ]
    )

    expect(game.completedObjects.cities).toHaveLength(1)
    const completedCity = game.completedObjects.cities[0]
    expect(completedCity?.score).toMatchObject({
      total: 10,
      players: { 1: 10 },
    })
    expect(game.scores[1]).toBe(10)
    expect(game.playersFollowers[1].ordinaryFollowers).toBe(7)
    expect(game.placedFollowers).toHaveLength(0)
  })

  it.each([
    ['road', 'roads', ObjectTypes.ROAD, 4],
    ['city', 'cities', ObjectTypes.CITY, 10],
  ] as const)(
    'синхронизирует фишки и начисляет очки при слиянии %s',
    (feature, collection, objectType, pointsPerPlayer) => {
      const game = new GameManager({ players })
      const sideType: TileSideType = feature
      const firstPoint: Point = {
        x: 14,
        y: 15,
        direction: 'east',
        pointType: sideType,
      }
      const secondPoint: Point = {
        x: 16,
        y: 15,
        direction: 'west',
        pointType: sideType,
      }
      const firstSegment = segment('segment-a', firstPoint, 1)
      const secondSegment = segment('segment-b', secondPoint, 2)
      const openCityOrRoadEnd: Point = {
        x: 14,
        y: 15,
        direction: 'north',
        pointType: sideType,
      }
      firstSegment.points.push(openCityOrRoadEnd)
      game.temporaryObjects[collection] = [firstSegment, secondSegment]
      game.tilePlacesStats[15] = {
        14: gridTile(14),
        15: gridTile(15, feature === 'city'),
        16: gridTile(16),
      }
      game.tilePlacesStats[14] = { 14: gridTile(14) }
      game.playersFollowers[1].ordinaryFollowers = 6
      game.playersFollowers[2].ordinaryFollowers = 6
      game.placedFollowers.push(
        {
          playerId: 1,
          objectId: firstSegment.id,
          point: firstPoint,
        },
        {
          playerId: 2,
          objectId: secondSegment.id,
          point: secondPoint,
        }
      )

      const connectionPoints: Point[] = [
        { x: 15, y: 15, direction: 'west', pointType: sideType },
        { x: 15, y: 15, direction: 'east', pointType: sideType },
      ]
      if (feature === 'road') {
        game.mergeRoads([firstSegment.id, secondSegment.id], connectionPoints)
      } else {
        game.mergeCities([firstSegment.id, secondSegment.id], connectionPoints)
      }

      expect(game.temporaryObjects[collection]).toHaveLength(1)
      const mergedTemporaryObject = game.temporaryObjects[collection][0]
      expect(mergedTemporaryObject).toBeDefined()
      if (!mergedTemporaryObject) return

      expect(
        mergedTemporaryObject.followers.map(({ objectId }) => objectId)
      ).toEqual([mergedTemporaryObject.id, mergedTemporaryObject.id])
      expect(game.placedFollowers.map(({ objectId }) => objectId)).toEqual([
        mergedTemporaryObject.id,
        mergedTemporaryObject.id,
      ])
      expect(game.completedObjects[collection]).toHaveLength(0)

      const closingPoint: Point = {
        x: 14,
        y: 14,
        direction: 'south',
        pointType: sideType,
      }
      if (feature === 'road') {
        game.mergeRoads([mergedTemporaryObject.id], [closingPoint])
      } else {
        game.mergeCities([mergedTemporaryObject.id], [closingPoint])
      }

      const completedObjects = game.completedObjects[collection]
      expect(game.temporaryObjects[collection]).toHaveLength(0)
      expect(completedObjects).toHaveLength(1)
      const [completedObject] = completedObjects
      expect(completedObject).toBeDefined()
      if (!completedObject) return

      expect(completedObject.id).not.toBe(firstSegment.id)
      expect(completedObject.id).not.toBe(secondSegment.id)
      expect(completedObject.followers.map(({ objectId }) => objectId)).toEqual(
        [completedObject.id, completedObject.id]
      )
      expect(completedObject.score).toMatchObject({
        total: pointsPerPlayer * 2,
        players: { 1: pointsPerPlayer, 2: pointsPerPlayer },
      })
      expect(game.scores).toEqual({ 1: pointsPerPlayer, 2: pointsPerPlayer })
      expect(game.playersFollowers[1].ordinaryFollowers).toBe(7)
      expect(game.playersFollowers[2].ordinaryFollowers).toBe(7)
      expect(game.placedFollowers).toHaveLength(0)

      const scoreAction = game.actionsHistory.find(
        (action) => action.actionType === ActionTypes.ADDING_SCORES
      )
      expect(scoreAction?.actionData).toMatchObject({
        objectType,
        score: completedObject.score,
      })
      const returnAction = game.actionsHistory.find(
        (action) => action.actionType === ActionTypes.BACK_FOLLOWER
      )
      expect(returnAction?.actionData.followers).toHaveLength(2)
    }
  )
})
