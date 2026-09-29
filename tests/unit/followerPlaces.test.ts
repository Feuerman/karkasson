import { describe, expect, it } from 'vitest'
import type { AvailableFollowerPlace } from '../../server/src/modules/GameManager'
import {
  SideName,
  TileSideType,
  type SideName as SideNameValue,
  type TileSideType as TileSideTypeValue,
} from '../../server/src/modules/types'
import { groupFollowerPlaces } from '../../src/utils/followerPlaces'

function makePlace(
  objectId: string,
  pointType: TileSideTypeValue,
  direction: SideNameValue
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
    const cityNorth = makePlace('city-1', TileSideType.City, SideName.North)
    const cityEast = makePlace('city-1', TileSideType.City, SideName.East)
    const roadWest = makePlace('road-1', TileSideType.Road, SideName.West)
    const roadSouth = makePlace('road-1', TileSideType.Road, SideName.South)

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
    const firstCity = makePlace('city-1', TileSideType.City, SideName.North)
    const secondCity = makePlace('city-2', TileSideType.City, SideName.South)
    const road = makePlace('road-1', TileSideType.Road, SideName.East)

    expect(groupFollowerPlaces([firstCity, secondCity, road])).toEqual([
      { place: firstCity, sameTypeCount: 2 },
      { place: secondCity, sameTypeCount: 2 },
      { place: road, sameTypeCount: 1 },
    ])
  })
})
