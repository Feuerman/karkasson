import {
  PointDirection,
  ObjectTypes,
  TileSideType,
  type PointType,
} from '@server/modules/types'
import type { AvailableFollowerPlace } from '@server/modules/GameManager'

type LabeledPointType = PointType | ObjectTypes.MONASTERY | ObjectTypes.GARDEN

const POINT_TYPE_TITLES: Record<LabeledPointType, string> = {
  [TileSideType.City]: 'Город',
  [TileSideType.Road]: 'Дорога',
  [TileSideType.Field]: 'Поле',
  [ObjectTypes.MONASTERY]: 'Монастырь',
  [ObjectTypes.GARDEN]: 'Сад',
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
