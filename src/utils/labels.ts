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
import { getLocale, t } from './i18n'

type LabeledPointType = PointType | ObjectTypes.MONASTERY | ObjectTypes.GARDEN

export const OBJECT_TYPE_NAMES: Record<ObjectTypes, string> = {
  get [ObjectTypes.CITY]() {
    return t('object_city')
  },
  get [ObjectTypes.ROAD]() {
    return t('object_road')
  },
  get [ObjectTypes.MONASTERY]() {
    return t('object_monastery')
  },
  get [ObjectTypes.GARDEN]() {
    return t('object_garden')
  },
  get [ObjectTypes.FIELD]() {
    return t('object_field')
  },
}

const capitalize = (value: string): string =>
  value.replace(/^./, (letter) => letter.toLocaleUpperCase(getLocale()))

const POINT_TYPE_TITLES: Record<LabeledPointType, string> = {
  get [TileSideType.City]() {
    return capitalize(OBJECT_TYPE_NAMES[ObjectTypes.CITY])
  },
  get [TileSideType.Road]() {
    return capitalize(OBJECT_TYPE_NAMES[ObjectTypes.ROAD])
  },
  get [TileSideType.Field]() {
    return capitalize(OBJECT_TYPE_NAMES[ObjectTypes.FIELD])
  },
  get [ObjectTypes.MONASTERY]() {
    return capitalize(OBJECT_TYPE_NAMES[ObjectTypes.MONASTERY])
  },
  get [ObjectTypes.GARDEN]() {
    return capitalize(OBJECT_TYPE_NAMES[ObjectTypes.GARDEN])
  },
}

export const POINT_TYPE_OBJECT_CASE: Record<TileSideType, string> = {
  get [TileSideType.Field]() {
    return t('object_field')
  },
  get [TileSideType.Road]() {
    return t('object_road_accusative')
  },
  get [TileSideType.City]() {
    return t('object_city')
  },
}

export const OBJECT_TYPE_GENITIVES: Record<ObjectTypes, string> = {
  get [ObjectTypes.CITY]() {
    return t('object_city_genitive')
  },
  get [ObjectTypes.ROAD]() {
    return t('object_road_genitive')
  },
  get [ObjectTypes.MONASTERY]() {
    return t('object_monastery_genitive')
  },
  get [ObjectTypes.GARDEN]() {
    return t('object_garden_genitive')
  },
  get [ObjectTypes.FIELD]() {
    return t('object_field_genitive')
  },
}

const POINT_DIRECTION_TITLES: Record<PointDirection, string> = {
  get [PointDirection.North]() {
    return t('direction_north')
  },
  get [PointDirection.South]() {
    return t('direction_south')
  },
  get [PointDirection.East]() {
    return t('direction_east')
  },
  get [PointDirection.West]() {
    return t('direction_west')
  },
  get [PointDirection.Center]() {
    return t('direction_center')
  },
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
  get 'west-north'() {
    return t('quadrant_west_north')
  },
  get 'east-north'() {
    return t('quadrant_east_north')
  },
  get 'east-south'() {
    return t('quadrant_east_south')
  },
  get 'west-south'() {
    return t('quadrant_west_south')
  },
}

const SIDE_TITLES: Record<SideName, string> = {
  get [SideName.North]() {
    return t('direction_north_lower')
  },
  get [SideName.East]() {
    return t('direction_east_lower')
  },
  get [SideName.South]() {
    return t('direction_south_lower')
  },
  get [SideName.West]() {
    return t('direction_west_lower')
  },
}

/** Подпись региона поля по его граничным портам: угол, сторона, весь тайл или пустая строка. */
function fieldRegionTitle(ports: FieldBoundaryPort[]): string {
  if (ports.length === FIELD_BOUNDARY_PORTS.length) {
    return t('field_whole_tile')
  }

  const quadrants = new Set(ports.map((port) => PORT_QUADRANT[port]))
  if (quadrants.size === 1) {
    const quadrant = [...quadrants][0]
    const title = QUADRANT_TITLES[quadrant]
    return title ? t('field_corner', { title }) : ''
  }

  const sides = new Set(ports.map(sideOfFieldPort))
  if (sides.size === 1) {
    const side = [...sides][0]
    return t('field_along_side', { side: SIDE_TITLES[side] })
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
    return t('field_region', {
      title,
      index: (place.point.regionIndex ?? 0) + 1,
    })
  })

  const indexedTitleCounts = new Map<string, number>()
  indexedTitles.forEach((title) => {
    indexedTitleCounts.set(title, (indexedTitleCounts.get(title) ?? 0) + 1)
  })

  return indexedTitles.map((title, index) => {
    const place = places[index]
    if (indexedTitleCounts.get(title) === 1) return title
    return t('field_tile', { title, x: place.point.x, y: place.point.y })
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
