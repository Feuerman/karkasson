import {
  PointDirection,
  ObjectTypes,
  TileSideType,
  type PointType,
} from '@server/modules/types'
import type { AvailableFollowerPlace } from '@server/modules/GameManager'
import { getFollowerPlaceType } from './followerPlaces'

type LabeledPointType = PointType | ObjectTypes.MONASTERY | ObjectTypes.GARDEN

export const OBJECT_TYPE_NAMES: Record<ObjectTypes, string> = {
  [ObjectTypes.CITY]: 'город',
  [ObjectTypes.ROAD]: 'дорога',
  [ObjectTypes.MONASTERY]: 'монастырь',
  [ObjectTypes.GARDEN]: 'сад',
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
}

const POINT_DIRECTION_TITLES: Record<PointDirection, string> = {
  [PointDirection.North]: 'Север',
  [PointDirection.South]: 'Юг',
  [PointDirection.East]: 'Восток',
  [PointDirection.West]: 'Запад',
  [PointDirection.Center]: 'Центр',
}

export const pointTypeTitle = (pointType?: LabeledPointType): string =>
  pointType ? POINT_TYPE_TITLES[pointType] : ''

export const pointDirectionTitle = (direction?: PointDirection): string =>
  direction ? POINT_DIRECTION_TITLES[direction] : ''

export const followerPlaceTitle = (
  place: AvailableFollowerPlace,
  sameTypeCount: number
): string => {
  const placeType = getFollowerPlaceType(place)
  if (placeType === ObjectTypes.GARDEN || placeType === ObjectTypes.MONASTERY) {
    return POINT_TYPE_TITLES[placeType]
  }

  const title = pointTypeTitle(place.point.pointType)
  if (sameTypeCount === 1) return title
  return `${title} — ${pointDirectionTitle(place.point.direction)}`
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
