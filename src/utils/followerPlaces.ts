import type { AvailableFollowerPlace } from '@server/modules/GameManager'

export interface GroupedFollowerPlace {
  place: AvailableFollowerPlace
  sameTypeCount: number
}

function getPlaceType(place: AvailableFollowerPlace): string {
  if (place.temporaryObject.isGarden) return 'garden'
  if (place.temporaryObject.isMonastery) return 'monastery'
  return place.point.pointType ?? 'center'
}

export function groupFollowerPlaces(
  places: AvailableFollowerPlace[]
): GroupedFollowerPlace[] {
  const groups = new Map<string, AvailableFollowerPlace>()

  for (const place of places) {
    const key = `${getPlaceType(place)}:${place.temporaryObject.id}`
    if (!groups.has(key)) groups.set(key, place)
  }

  const groupedPlaces = [...groups.values()]
  const countsByType = new Map<string, number>()

  for (const place of groupedPlaces) {
    const type = getPlaceType(place)
    countsByType.set(type, (countsByType.get(type) ?? 0) + 1)
  }

  return groupedPlaces.map((place) => ({
    place,
    sameTypeCount: countsByType.get(getPlaceType(place)) ?? 1,
  }))
}
