import { describe, expect, it } from 'vitest'
import type { AvailableFollowerPlace } from '@server/modules/GameManager'
import {
  PointDirection,
  SideName,
  TileSideType,
  type BaseObject,
  type SideName as SideNameValue,
  type TileSideType as TileSideTypeValue,
} from '@server/modules/types'
import { groupFollowerPlaces } from '@/utils/followerPlaces'

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

function makeCenterPlace(
  objectId: string,
  flags: Pick<BaseObject, 'isMonastery' | 'isGarden'>
): AvailableFollowerPlace {
  const point = { x: 0, y: 0, direction: PointDirection.Center }
  return {
    point,
    temporaryObject: {
      id: objectId,
      points: [point],
      followers: [],
      ...flags,
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

  // Тайл I: сад в центре и два отдельных города на северной и западной стороне.
  it('counts a garden apart from the cities around it', () => {
    const garden = makeCenterPlace('garden-1', { isGarden: true })
    const northCity = makePlace('city-1', TileSideType.City, SideName.North)
    const westCity = makePlace('city-2', TileSideType.City, SideName.West)

    expect(groupFollowerPlaces([garden, northCity, westCity])).toEqual([
      { place: garden, sameTypeCount: 1 },
      { place: northCity, sameTypeCount: 2 },
      { place: westCity, sameTypeCount: 2 },
    ])
  })

  // Тайл A: монастырь в центре и дорога на южной стороне.
  it('counts a monastery apart from the road beside it', () => {
    const monastery = makeCenterPlace('monastery-1', { isMonastery: true })
    const road = makePlace('road-1', TileSideType.Road, SideName.South)

    expect(groupFollowerPlaces([monastery, road])).toEqual([
      { place: monastery, sameTypeCount: 1 },
      { place: road, sameTypeCount: 1 },
    ])
  })
})
