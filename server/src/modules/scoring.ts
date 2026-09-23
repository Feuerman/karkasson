import type {
  BaseObject,
  ObjectFollower,
  PlayerId,
  ScoreForObject,
  Scores,
  TilePlacesStats,
} from './types'

/**
 * Распределяет очки объекта между игроками-лидерами
 * (у кого больше всего подданных в объекте — тот и получает очки).
 * Возвращает разбивку и попутно начисляет очки в общий счёт.
 */
function distributeScore(
  points: number,
  followers: ObjectFollower[],
  scores: Scores
): ScoreForObject {
  if (!followers.length) {
    return { total: points, players: {} }
  }

  const followersCountByPlayer: Record<string, number> = {}
  for (const follower of followers) {
    const key = String(follower.playerId)
    followersCountByPlayer[key] = (followersCountByPlayer[key] ?? 0) + 1
  }

  const maxCount = Math.max(...Object.values(followersCountByPlayer))
  const players: Partial<Record<PlayerId, number>> = {}
  let total = 0

  for (const [playerId, count] of Object.entries(followersCountByPlayer)) {
    if (count === maxCount) {
      total += points
      players[playerId] = points
      scores[playerId] = (scores[playerId] ?? 0) + points
    }
  }

  return { total, players }
}

function countUniqueTiles(
  tilePlacesStats: TilePlacesStats,
  points: BaseObject['points']
): number {
  const uniqueTiles = new Set<string>()

  for (const point of points) {
    if (tilePlacesStats[point.y]?.[point.x]) {
      uniqueTiles.add(`${point.y},${point.x}`)
    }
  }

  return uniqueTiles.size
}

export function calcRoadScore(
  tilePlacesStats: TilePlacesStats,
  road: BaseObject,
  scores: Scores
): ScoreForObject {
  const points = countUniqueTiles(tilePlacesStats, road.points)
  const result = distributeScore(points, road.followers, scores)
  return road.followers.length ? { ...result, objectId: road.id } : result
}

export function calcCityScore(
  tilePlacesStats: TilePlacesStats,
  city: BaseObject,
  scores: Scores
): ScoreForObject {
  const uniqueTiles = new Set<string>()
  let shieldCount = 0

  for (const point of city.points) {
    const tile = tilePlacesStats[point.y]?.[point.x]
    if (tile && !uniqueTiles.has(`${point.y},${point.x}`)) {
      uniqueTiles.add(`${point.y},${point.x}`)
      if (tile.withShield) {
        shieldCount++
      }
    }
  }

  const points = uniqueTiles.size * 2 + shieldCount * 2
  const result = distributeScore(points, city.followers, scores)
  return city.followers.length ? { ...result, objectId: city.id } : result
}

/**
 * Очки «незавершённого» монастыря: 1 очко за сам монастырь и по 1 очку
 * за каждую занятую клетку в окрестности 3×3. Используется для отзыва
 * аббата (в этой версии финального подсчёта незавершённых объектов нет).
 */
export function calcMonasteryPoints(
  tilePlacesStats: TilePlacesStats,
  monastery: BaseObject
): number {
  const monasteryPoint = monastery.points[0]
  if (!monasteryPoint) return 0

  let count = 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (tilePlacesStats[monasteryPoint.y + dy]?.[monasteryPoint.x + dx]) {
        count++
      }
    }
  }

  return count
}
