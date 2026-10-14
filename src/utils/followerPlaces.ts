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

export function groupFollowerPlaces(
  places: AvailableFollowerPlace[]
): GroupedFollowerPlace[] {
  const groups = new Map<string, AvailableFollowerPlace>()

  for (const place of places) {
    const key = `${getFollowerPlaceType(place)}:${place.temporaryObject.id}`
    if (!groups.has(key)) groups.set(key, place)
  }

  const groupedPlaces = [...groups.values()]
  const countsByType = new Map<string, number>()

  for (const place of groupedPlaces) {
    const type = getFollowerPlaceType(place)
    countsByType.set(type, (countsByType.get(type) ?? 0) + 1)
  }

  return groupedPlaces.map((place) => ({
    place,
    sameTypeCount: countsByType.get(getFollowerPlaceType(place)) ?? 1,
  }))
}
