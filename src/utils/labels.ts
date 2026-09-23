import type { PointType, PointDirection } from '@server/modules/types'
import type { AvailableFollowerPlace } from '@server/modules/GameManager'

const POINT_TYPE_TITLES: Record<string, string> = {
  city: 'Город',
  road: 'Дорога',
  field: 'Поле',
  monastery: 'Монастырь',
  garden: 'Сад',
}

const POINT_DIRECTION_TITLES: Record<string, string> = {
  north: 'Север',
  south: 'Юг',
  east: 'Восток',
  west: 'Запад',
  center: 'Центр',
}

export const pointTypeTitle = (pointType?: PointType | 'monastery'): string =>
  POINT_TYPE_TITLES[pointType ?? ''] ?? ''

export const pointDirectionTitle = (direction?: PointDirection): string =>
  POINT_DIRECTION_TITLES[direction ?? ''] ?? ''

export const followerPlaceIcon = (place: AvailableFollowerPlace): string => {
  if (place.temporaryObject?.isGarden) return 'i-lucide-flower-2'
  if (place.temporaryObject?.isMonastery) return 'i-lucide-church'
  switch (place.point?.pointType) {
    case 'city':
      return 'i-lucide-castle'
    case 'road':
      return 'i-lucide-route'
    case 'field':
      return 'i-lucide-sprout'
    default:
      return 'i-lucide-person-standing'
  }
}
