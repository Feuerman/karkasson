import type {
  BaseObject,
  ObjectFollower,
  PlayerId,
  ScoreDetailLine,
  ScoreDetails,
  ScoreForObject,
  Scores,
  TilePlacesStats,
} from './types'
import { ExpansionName, ObjectTypes, PointDirection } from './types'

/**
 * Родительный падеж названия объекта для текстов детализации очков.
 * Ключи совпадают с типами объектов, поэтому выбираются по типу объекта.
 */
export const CENTRAL_OBJECT_NAMES: Record<
  ObjectTypes.MONASTERY | ObjectTypes.GARDEN,
  'монастыря' | 'сада'
> = {
  [ObjectTypes.MONASTERY]: 'монастыря',
  [ObjectTypes.GARDEN]: 'сада',
}

/**
 * Распределяет очки объекта между игроками-лидерами
 * (у кого больше всего подданных в объекте — тот и получает очки).
 * Возвращает разбивку и попутно начисляет очки в общий счёт.
 */
export function distributeScore(
  points: number,
  followers: ObjectFollower[],
  scores: Scores,
  weightOf: (follower: ObjectFollower) => number = () => 1
): ScoreForObject {
  if (!followers.length) {
    return { total: points, players: {} }
  }

  const followersCountByPlayer: Record<string, number> = {}
  for (const follower of followers) {
    const key = String(follower.playerId)
    followersCountByPlayer[key] =
      (followersCountByPlayer[key] ?? 0) + weightOf(follower)
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
  scores: Scores,
  isCompleted = true,
  innsAndCathedralsEnabled = false,
  useBigFollowers = false
): ScoreForObject {
  const parts = roadScoreParts(
    tilePlacesStats,
    road,
    isCompleted,
    innsAndCathedralsEnabled
  )
  const result = distributeScore(
    parts.points,
    road.followers,
    scores,
    (follower) => (useBigFollowers && follower.isBigFollower ? 2 : 1)
  )
  return road.followers.length ? { ...result, objectId: road.id } : result
}

interface RoadScoreParts {
  tiles: number
  pointsPerTile: number
  points: number
  hasInn: boolean
}

/** Общие для подсчёта и детализации примитивы: тайлы, ставка, сумма. */
function roadScoreParts(
  tilePlacesStats: TilePlacesStats,
  road: BaseObject,
  isCompleted: boolean,
  innsAndCathedralsEnabled: boolean
): RoadScoreParts {
  const tiles = countUniqueTiles(tilePlacesStats, road.points)
  const hasInn =
    road.expansion === ExpansionName.InnsAndCathedrals ||
    Boolean(innsAndCathedralsEnabled && road.hasInn)
  return {
    tiles,
    pointsPerTile: hasInn ? 2 : 1,
    points: hasInn ? (isCompleted ? tiles * 2 : 0) : tiles,
    hasInn,
  }
}

/**
 * Описание расчёта очков дороги для истории: из чего сложилась сумма.
 * Считает теми же примитивами, что и calcRoadScore, поэтому строки
 * детализации всегда сходятся с начисленной суммой.
 */
export function describeRoadScore(
  tilePlacesStats: TilePlacesStats,
  road: BaseObject,
  isCompleted = true,
  innsAndCathedralsEnabled = false
): ScoreDetails {
  const parts = roadScoreParts(
    tilePlacesStats,
    road,
    isCompleted,
    innsAndCathedralsEnabled
  )
  return {
    details: [
      {
        label: 'Тайлы дороги',
        count: parts.tiles,
        pointsPerUnit: parts.pointsPerTile,
        total: parts.points,
      },
    ],
    modifiers: parts.hasInn
      ? [
          isCompleted
            ? 'Таверна: 2 очка за каждый тайл дороги'
            : 'Таверна: незавершённая дорога приносит 0 очков',
        ]
      : [],
  }
}

export function calcCityScore(
  tilePlacesStats: TilePlacesStats,
  city: BaseObject,
  scores: Scores,
  isCompleted = true,
  innsAndCathedralsEnabled = false,
  useBigFollowers = false
): ScoreForObject {
  const parts = cityScoreParts(
    tilePlacesStats,
    city,
    isCompleted,
    innsAndCathedralsEnabled
  )
  const result = distributeScore(
    parts.points,
    city.followers,
    scores,
    (follower) => (useBigFollowers && follower.isBigFollower ? 2 : 1)
  )
  return city.followers.length ? { ...result, objectId: city.id } : result
}

interface CityScoreParts {
  tiles: number
  shields: number
  pointsPerUnit: number
  points: number
  hasCathedral: boolean
}

/** Общие для подсчёта и детализации примитивы: тайлы, гербы, ставка, сумма. */
function cityScoreParts(
  tilePlacesStats: TilePlacesStats,
  city: BaseObject,
  isCompleted: boolean,
  innsAndCathedralsEnabled: boolean
): CityScoreParts {
  const uniqueTiles = new Set<string>()
  let shieldCount = 0

  for (const point of city.points) {
    const tile = tilePlacesStats[point.y]?.[point.x]
    if (tile && !uniqueTiles.has(`${point.y},${point.x}`)) {
      uniqueTiles.add(`${point.y},${point.x}`)
      const cityContainsShield = Boolean(
        tile.cityShieldGroups?.some((group) =>
          city.points.some(
            (cityPoint) =>
              cityPoint.x === point.x &&
              cityPoint.y === point.y &&
              cityPoint.direction !== undefined &&
              cityPoint.direction !== PointDirection.Center &&
              group.includes(cityPoint.direction)
          )
        )
      )
      if (tile.withShield || cityContainsShield) {
        shieldCount++
      }
    }
  }

  const hasCathedral =
    city.expansion === ExpansionName.InnsAndCathedrals ||
    Boolean(innsAndCathedralsEnabled && city.hasCathedral)
  const pointsPerUnit = isCompleted ? (hasCathedral ? 3 : 2) : 1
  const basePoints =
    uniqueTiles.size * pointsPerUnit + shieldCount * pointsPerUnit
  return {
    tiles: uniqueTiles.size,
    shields: shieldCount,
    pointsPerUnit,
    points: hasCathedral && !isCompleted ? 0 : basePoints,
    hasCathedral,
  }
}

/**
 * Описание расчёта очков города для истории. Незавершённый город с собором
 * даёт 0 очков, поэтому строки расчёта показываются с нулевой суммой.
 */
export function describeCityScore(
  tilePlacesStats: TilePlacesStats,
  city: BaseObject,
  isCompleted = true,
  innsAndCathedralsEnabled = false
): ScoreDetails {
  const parts = cityScoreParts(
    tilePlacesStats,
    city,
    isCompleted,
    innsAndCathedralsEnabled
  )
  const earned = parts.points === 0 ? 0 : 1
  const details: ScoreDetailLine[] = [
    {
      label: 'Тайлы города',
      count: parts.tiles,
      pointsPerUnit: parts.pointsPerUnit,
      total: earned * parts.tiles * parts.pointsPerUnit,
    },
  ]
  if (parts.shields > 0) {
    details.push({
      label: 'Гербы в городе',
      count: parts.shields,
      pointsPerUnit: parts.pointsPerUnit,
      total: earned * parts.shields * parts.pointsPerUnit,
    })
  }
  return {
    details,
    modifiers: parts.hasCathedral
      ? [
          isCompleted
            ? 'Собор: 3 очка за каждый тайл и герб города'
            : 'Собор: незавершённый город приносит 0 очков',
        ]
      : [],
  }
}

/**
 * Описание расчёта очков монастыря и сада: 1 очко за сам тайл и по 1 очку
 * за каждую занятую клетку в окрестности 3×3. Значение совпадает с
 * calcMonasteryPoints/calcGardenPoints.
 */
export function describeCentralObjectPoints(
  points: number,
  objectType: 'монастыря' | 'сада'
): ScoreDetails {
  const around = Math.max(points - 1, 0)
  const details: ScoreDetailLine[] = [
    {
      label: `Тайл ${objectType}`,
      count: 1,
      pointsPerUnit: 1,
      total: points > 0 ? 1 : 0,
    },
  ]
  if (around > 0) {
    details.push({
      label: 'Занятые клетки вокруг',
      count: around,
      pointsPerUnit: 1,
      total: around,
    })
  }
  return { details, modifiers: [] }
}

/**
 * Описание расчёта очков завершённого монастыря или сада: по правилам
 * такой объект всегда приносит 9 очков независимо от застройки вокруг.
 */
export function describeCompletedCentralObject(
  objectType: 'монастыря' | 'сада'
): ScoreDetails {
  return {
    details: [
      {
        label: `Завершённый ${objectType === 'монастыря' ? 'монастырь' : 'сад'}`,
        count: 1,
        pointsPerUnit: 9,
        total: 9,
      },
    ],
    modifiers: [],
  }
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

/**
 * Очки «незавершённого» сада: сад считается так же, как монастырь —
 * 1 очко за сам тайл и по 1 очку за каждую занятую клетку в окрестности 3×3.
 */
export function calcGardenPoints(
  tilePlacesStats: TilePlacesStats,
  garden: BaseObject
): number {
  return calcMonasteryPoints(tilePlacesStats, garden)
}
