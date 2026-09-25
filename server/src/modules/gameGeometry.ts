import type { Point, Tile, TilePlacesStats } from './types'

export function getPrecisionCoordinates(point: Point): {
  x: number
  y: number
} {
  let x = point.x
  let y = point.y

  if (point.direction === 'north') {
    y -= 0.5
  } else if (point.direction === 'south') {
    y += 0.5
  } else if (point.direction === 'east') {
    x += 0.5
  } else if (point.direction === 'west') {
    x -= 0.5
  }

  return { x, y }
}

export function isOppositePoint(point: Point, oppositePoint: Point): boolean {
  const pointCoordinates = getPrecisionCoordinates(point)
  const oppositePointCoordinates = getPrecisionCoordinates(oppositePoint)

  return (
    pointCoordinates.x === oppositePointCoordinates.x &&
    pointCoordinates.y === oppositePointCoordinates.y
  )
}

export function isCorrectTilePosition(
  tile: Tile,
  rowIndex: number,
  tileIndex: number,
  tilePlacesStats: TilePlacesStats,
  isGridEmpty: boolean
): boolean {
  if (isGridEmpty) return true
  if (tilePlacesStats[rowIndex]?.[tileIndex]) return false

  // Сопоставляем стороны явно: порядок ключей sides может меняться при повороте.
  const matches = [
    {
      adjacent: tilePlacesStats[rowIndex - 1]?.[tileIndex]?.sides?.south,
      own: tile.sides.north,
    },
    {
      adjacent: tilePlacesStats[rowIndex]?.[tileIndex + 1]?.sides?.west,
      own: tile.sides.east,
    },
    {
      adjacent: tilePlacesStats[rowIndex + 1]?.[tileIndex]?.sides?.north,
      own: tile.sides.south,
    },
    {
      adjacent: tilePlacesStats[rowIndex]?.[tileIndex - 1]?.sides?.east,
      own: tile.sides.west,
    },
  ]

  if (!matches.some(({ adjacent }) => Boolean(adjacent))) {
    return false
  }

  return matches.every(({ adjacent, own }) => !adjacent || adjacent === own)
}
