import {
  PointDirection,
  ObjectTypes,
  TileSideType,
  SideName,
  type PointType,
} from '@server/modules/types'
import type { AvailableFollowerPlace } from '@server/modules/GameManager'
import type {
  FieldBoundaryPort,
  TileFieldTopology,
} from '@server/data/fieldTopology'
import {
  FIELD_BOUNDARY_PORTS,
  sideOfFieldPort,
} from '@server/data/fieldTopology'
import { getFollowerPlaceType } from './followerPlaces'

type LabeledPointType = PointType | ObjectTypes.MONASTERY | ObjectTypes.GARDEN

export const OBJECT_TYPE_NAMES: Record<ObjectTypes, string> = {
  [ObjectTypes.CITY]: 'город',
  [ObjectTypes.ROAD]: 'дорога',
  [ObjectTypes.MONASTERY]: 'монастырь',
  [ObjectTypes.GARDEN]: 'сад',
  [ObjectTypes.FIELD]: 'поле',
}

const capitalize = (value: string): string =>
  value.replace(/^./, (letter) => letter.toLocaleUpperCase('ru'))

const POINT_TYPE_TITLES: Record<LabeledPointType, string> = {
  [TileSideType.City]: capitalize(OBJECT_TYPE_NAMES[ObjectTypes.CITY]),
  [TileSideType.Road]: capitalize(OBJECT_TYPE_NAMES[ObjectTypes.ROAD]),
  [TileSideType.Field]: 'Поле',
  [ObjectTypes.MONASTERY]: capitalize(OBJECT_TYPE_NAMES[ObjectTypes.MONASTERY]),
  [ObjectTypes.GARDEN]: capitalize(OBJECT_TYPE_NAMES[ObjectTypes.GARDEN]),
}

export const POINT_TYPE_OBJECT_CASE: Record<TileSideType, string> = {
  [TileSideType.Field]: 'поле',
  [TileSideType.Road]: 'дорогу',
  [TileSideType.City]: OBJECT_TYPE_NAMES[ObjectTypes.CITY],
}

export const OBJECT_TYPE_GENITIVES: Record<ObjectTypes, string> = {
  [ObjectTypes.CITY]: 'города',
  [ObjectTypes.ROAD]: 'дороги',
  [ObjectTypes.MONASTERY]: 'монастыря',
  [ObjectTypes.GARDEN]: 'сада',
  [ObjectTypes.FIELD]: 'поля',
}

const POINT_DIRECTION_TITLES: Record<PointDirection, string> = {
  [PointDirection.North]: 'Север',
  [PointDirection.South]: 'Юг',
  [PointDirection.East]: 'Восток',
  [PointDirection.West]: 'Запад',
  [PointDirection.Center]: 'Центр',
}

const PORT_QUADRANT: Record<
  FieldBoundaryPort,
  'west-north' | 'east-north' | 'east-south' | 'west-south'
> = {
  northWest: 'west-north',
  westNorth: 'west-north',
  northEast: 'east-north',
  eastNorth: 'east-north',
  eastSouth: 'east-south',
  southEast: 'east-south',
  southWest: 'west-south',
  westSouth: 'west-south',
}

const QUADRANT_TITLES: Record<string, string> = {
  'west-north': 'северо-запад',
  'east-north': 'северо-восток',
  'east-south': 'юго-восток',
  'west-south': 'юго-запад',
}

const SIDE_TITLES: Record<SideName, string> = {
  [SideName.North]: 'север',
  [SideName.East]: 'восток',
  [SideName.South]: 'юг',
  [SideName.West]: 'запад',
}

/** Подпись региона поля по его граничным портам: угол, сторона, весь тайл или пустая строка. */
function fieldRegionTitle(ports: FieldBoundaryPort[]): string {
  if (ports.length === FIELD_BOUNDARY_PORTS.length) return 'вокруг всего тайла'

  const quadrants = new Set(ports.map((port) => PORT_QUADRANT[port]))
  if (quadrants.size === 1) {
    const quadrant = [...quadrants][0]
    const title = QUADRANT_TITLES[quadrant]
    return title ? `угол: ${title}` : ''
  }

  const sides = new Set(ports.map(sideOfFieldPort))
  if (sides.size === 1) {
    const side = [...sides][0]
    return `вдоль стороны: ${SIDE_TITLES[side]}`
  }

  return ''
}

export const pointTypeTitle = (pointType?: LabeledPointType): string =>
  pointType ? POINT_TYPE_TITLES[pointType] : ''

export const pointDirectionTitle = (direction?: PointDirection): string =>
  direction ? POINT_DIRECTION_TITLES[direction] : ''

export const followerPlaceTitle = (
  place: AvailableFollowerPlace,
  sameTypeCount: number,
  fieldTopology?: TileFieldTopology
): string => {
  const placeType = getFollowerPlaceType(place)
  if (placeType === ObjectTypes.GARDEN || placeType === ObjectTypes.MONASTERY) {
    return POINT_TYPE_TITLES[placeType]
  }

  const title = pointTypeTitle(place.point.pointType)
  if (placeType === TileSideType.Field) {
    const regionIndex = place.point.regionIndex
    const ports = fieldTopology?.[regionIndex ?? 0]?.boundaryPorts
    if (ports?.length) {
      const regionTitle = fieldRegionTitle(ports)
      return regionTitle ? `${title} — ${regionTitle}` : title
    }
    const regionLabel = regionIndex !== undefined ? ` ${regionIndex + 1}` : ''
    if (sameTypeCount === 1) return `${title}${regionLabel}`
    return `${title}${regionLabel} — ${pointDirectionTitle(place.point.direction)}`
  }
  if (sameTypeCount === 1) return title
  return `${title} — ${pointDirectionTitle(place.point.direction)}`
}

/** Различает локальные области поля, у которых совпал набор сторон тайла. */
export const disambiguateFollowerPlaceTitles = (
  places: readonly AvailableFollowerPlace[],
  titles: readonly string[]
): string[] => {
  const titleCounts = new Map<string, number>()
  titles.forEach((title) => {
    titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1)
  })

  const indexedTitles = titles.map((title, index) => {
    const place = places[index]
    if (
      titleCounts.get(title) === 1 ||
      getFollowerPlaceType(place) !== TileSideType.Field
    ) {
      return title
    }
    return `${title} (участок ${(place.point.regionIndex ?? 0) + 1})`
  })

  const indexedTitleCounts = new Map<string, number>()
  indexedTitles.forEach((title) => {
    indexedTitleCounts.set(title, (indexedTitleCounts.get(title) ?? 0) + 1)
  })

  return indexedTitles.map((title, index) => {
    const place = places[index]
    if (indexedTitleCounts.get(title) === 1) return title
    return `${title} (тайл ${place.point.x}, ${place.point.y})`
  })
}

export const followerPlaceIcon = (place: AvailableFollowerPlace): string => {
  if (place.temporaryObject?.isGarden) return 'i-lucide-flower-2'
  if (place.temporaryObject?.isMonastery) return 'i-lucide-church'
  switch (place.point?.pointType) {
    case TileSideType.City:
      return 'i-lucide-castle'
    case TileSideType.Road:
      return 'i-lucide-route'
    case TileSideType.Field:
      return 'i-lucide-sprout'
    default:
      return 'i-lucide-person-standing'
  }
}
