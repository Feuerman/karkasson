import { describe, expect, it } from 'vitest'
import type { AvailableFollowerPlace } from '../../server/src/modules/GameManager'
import { groupFollowerPlaces } from '../../src/utils/followerPlaces'

function makePlace(
  objectId: string,
  pointType: 'city' | 'road' | 'field',
  direction: 'north' | 'east' | 'south' | 'west'
): AvailableFollowerPlace {
  const point = { x: 0, y: 0, direction, pointType }
  return {
    point,
    temporaryObject: {
      id: objectId,
      points: [point],
      followers: [],
    },
  }
}

describe('groupFollowerPlaces', () => {
  it('groups multiple positions belonging to the same city or road', () => {
    const cityNorth = makePlace('city-1', 'city', 'north')
    const cityEast = makePlace('city-1', 'city', 'east')
    const roadWest = makePlace('road-1', 'road', 'west')
    const roadSouth = makePlace('road-1', 'road', 'south')

    const grouped = groupFollowerPlaces([
      cityNorth,
      cityEast,
      roadWest,
      roadSouth,
    ])

    expect(grouped).toEqual([
      { place: cityNorth, sameTypeCount: 1 },
      { place: roadWest, sameTypeCount: 1 },
    ])
  })

  it('keeps separate objects of the same type distinguishable', () => {
    const firstCity = makePlace('city-1', 'city', 'north')
    const secondCity = makePlace('city-2', 'city', 'south')
    const road = makePlace('road-1', 'road', 'east')

    expect(groupFollowerPlaces([firstCity, secondCity, road])).toEqual([
      { place: firstCity, sameTypeCount: 2 },
      { place: secondCity, sameTypeCount: 2 },
      { place: road, sameTypeCount: 1 },
    ])
  })
})
