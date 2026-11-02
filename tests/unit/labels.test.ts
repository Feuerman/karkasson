import { describe, expect, it } from 'vitest'
import {
  disambiguateFollowerPlaceTitles,
  followerPlaceIcon,
  followerPlaceTitle,
  pointDirectionTitle,
  pointTypeTitle,
} from '@/utils/labels'
import {
  ObjectTypes,
  PointDirection,
  TileSideType,
} from '@server/modules/types'
import type { BaseObject, Point } from '@server/modules/types'
import type { AvailableFollowerPlace } from '@server/modules/GameManager'
import { field, wholeTileField } from '@server/data/fieldTopology'

/**
 * Подписи и иконки мест показываются игроку, поэтому сад и монастырь не
 * должны путаться с городами и дорогами: они опознаются по флагу объекта,
 * а не по типу стороны.
 */

const point = (overrides: Partial<Point> = {}): Point => ({
  x: 15,
  y: 15,
  direction: PointDirection.North,
  pointType: TileSideType.Road,
  ...overrides,
})

const object = (flags: Partial<BaseObject> = {}): BaseObject => ({
  id: 'label-object',
  points: [point()],
  followers: [],
  ...flags,
})

const place = (
  pointOverrides: Partial<Point> = {},
  objectFlags: Partial<BaseObject> = {}
): AvailableFollowerPlace => ({
  point: point(pointOverrides),
  temporaryObject: object(objectFlags),
})

const placeWithoutPointType: AvailableFollowerPlace = {
  point: { x: 15, y: 15, direction: PointDirection.Center },
  temporaryObject: object(),
}

describe('pointTypeTitle', () => {
  const TITLES: Array<[Parameters<typeof pointTypeTitle>[0], string]> = [
    [TileSideType.City, 'Город'],
    [TileSideType.Road, 'Дорога'],
    [TileSideType.Field, 'Поле'],
    [ObjectTypes.MONASTERY, 'Монастырь'],
    [ObjectTypes.GARDEN, 'Сад'],
  ]

  it.each(TITLES)('для %s даёт «%s»', (pointType, expected) => {
    expect(pointTypeTitle(pointType)).toBe(expected)
  })

  it('для отсутствующего типа даёт пустую строку', () => {
    expect(pointTypeTitle(undefined)).toBe('')
  })
})

describe('pointDirectionTitle', () => {
  it.each([
    [PointDirection.North, 'Север'],
    [PointDirection.South, 'Юг'],
    [PointDirection.East, 'Восток'],
    [PointDirection.West, 'Запад'],
    [PointDirection.Center, 'Центр'],
  ])('для %s даёт «%s»', (direction, expected) => {
    expect(pointDirectionTitle(direction)).toBe(expected)
  })

  it('для отсутствующего направления даёт пустую строку', () => {
    expect(pointDirectionTitle(undefined)).toBe('')
  })
})

describe('followerPlaceIcon', () => {
  it.each([
    [TileSideType.City, 'i-lucide-castle'],
    [TileSideType.Road, 'i-lucide-route'],
    [TileSideType.Field, 'i-lucide-sprout'],
  ])('для стороны %s берёт иконку %s', (pointType, expected) => {
    expect(followerPlaceIcon(place({ pointType }))).toBe(expected)
  })

  it('для сада и монастыря берёт иконку по флагу объекта', () => {
    expect(followerPlaceIcon(place({}, { isGarden: true }))).toBe(
      'i-lucide-flower-2'
    )
    expect(followerPlaceIcon(place({}, { isMonastery: true }))).toBe(
      'i-lucide-church'
    )
  })

  it('отдаёт саду иконку сада, даже если тип стороны — город', () => {
    expect(
      followerPlaceIcon(
        place(
          { pointType: TileSideType.City, direction: PointDirection.East },
          { isGarden: true }
        )
      )
    ).toBe('i-lucide-flower-2')
  })

  it('для места без типа стороны даёт иконку человека', () => {
    expect(followerPlaceIcon(placeWithoutPointType)).toBe(
      'i-lucide-person-standing'
    )
  })
})

describe('followerPlaceTitle', () => {
  it('clarifies a field choice by the sides of the tile it reaches', () => {
    const fieldPlace = place({ pointType: TileSideType.Field, regionIndex: 0 })

    expect(
      followerPlaceTitle(fieldPlace, 1, [field(['northWest', 'westNorth'])])
    ).toBe('Поле — северо-запад')
  })

  it('describes a field spanning the whole tile', () => {
    const fieldPlace = place({ pointType: TileSideType.Field, regionIndex: 0 })

    expect(followerPlaceTitle(fieldPlace, 1, wholeTileField())).toBe(
      'Поле — весь тайл'
    )
  })

  it('keeps an indexed fallback when field topology is missing', () => {
    expect(
      followerPlaceTitle(
        place({ pointType: TileSideType.Field, regionIndex: 1 }),
        1
      )
    ).toBe('Поле 2')
  })

  it('disambiguates matching field labels by region and tile coordinates', () => {
    const firstRegion = place({
      x: 15,
      y: 15,
      pointType: TileSideType.Field,
      regionIndex: 0,
    })
    const secondRegion = place({
      x: 15,
      y: 15,
      pointType: TileSideType.Field,
      regionIndex: 1,
    })
    const sameRegionOnAnotherTile = place({
      x: 16,
      y: 15,
      pointType: TileSideType.Field,
      regionIndex: 0,
    })

    expect(
      disambiguateFollowerPlaceTitles(
        [firstRegion, secondRegion],
        ['Поле — восток и юг', 'Поле — восток и юг']
      )
    ).toEqual([
      'Поле — восток и юг (участок 1)',
      'Поле — восток и юг (участок 2)',
    ])
    expect(
      disambiguateFollowerPlaceTitles(
        [firstRegion, sameRegionOnAnotherTile],
        ['Поле — восток и юг', 'Поле — восток и юг']
      )
    ).toEqual([
      'Поле — восток и юг (участок 1) (тайл 15, 15)',
      'Поле — восток и юг (участок 1) (тайл 16, 15)',
    ])
  })
})
