import type { AvailableFollowerPlace } from '@server/modules/GameManager'
import {
  ObjectTypes,
  PointDirection,
  TileSideType,
} from '@server/modules/types'

export interface GroupedFollowerPlace {
  place: AvailableFollowerPlace
  sameTypeCount: number
}

export type FollowerPlaceType =
  TileSideType | ObjectTypes.GARDEN | ObjectTypes.MONASTERY | PointDirection

export function getFollowerPlaceType(
  place: AvailableFollowerPlace
): FollowerPlaceType {
  if (place.temporaryObject.isGarden) return ObjectTypes.GARDEN
  if (place.temporaryObject.isMonastery) return ObjectTypes.MONASTERY
  return place.point.pointType ?? PointDirection.Center
}

/** Ключ группировки места: для полей добавляется regionIndex, иначе регионы
 * одного тайла склеились бы в одну кнопку. */
export function followerPlaceGroupKey(place: AvailableFollowerPlace): string {
  const type = getFollowerPlaceType(place)
  if (type === TileSideType.Field) {
    return `${type}:${place.point.x}:${place.point.y}:${place.temporaryObject.id}:${place.point.regionIndex ?? 0}`
  }
  return `${type}:${place.temporaryObject.id}`
}

export function groupFollowerPlaces(
  places: AvailableFollowerPlace[]
): GroupedFollowerPlace[] {
  const groups = new Map<string, AvailableFollowerPlace>()

  for (const place of places) {
    const key = followerPlaceGroupKey(place)
    if (!groups.has(key)) groups.set(key, place)
  }

  const groupedPlaces = [...groups.values()]
  const countsByType = new Map<string, number>()
  const countsByKey = new Map<string, number>()

  for (const place of groupedPlaces) {
    const type = getFollowerPlaceType(place)
    const key = followerPlaceGroupKey(place)
    countsByType.set(type, (countsByType.get(type) ?? 0) + 1)
    countsByKey.set(key, (countsByKey.get(key) ?? 0) + 1)
  }

  return groupedPlaces.map((place) => {
    const type = getFollowerPlaceType(place)
    const key = followerPlaceGroupKey(place)
    // Для полей считаем по ключу группы (regionIndex), для остального — по типу.
    const sameTypeCount =
      type === TileSideType.Field
        ? (countsByKey.get(key) ?? 1)
        : (countsByType.get(type) ?? 1)
    return { place, sameTypeCount }
  })
}
