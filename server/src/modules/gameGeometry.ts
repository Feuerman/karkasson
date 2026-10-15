import {
  SideName,
  TileSideType,
  type Point,
  type Tile,
  type TilePlacesStats,
  type TileSideConflict,
} from './types'

export function getPrecisionCoordinates(point: Point): {
  x: number
  y: number
} {
  let x = point.x
  let y = point.y

  if (point.direction === SideName.North) {
    y -= 0.5
  } else if (point.direction === SideName.South) {
    y += 0.5
  } else if (point.direction === SideName.East) {
    x += 0.5
  } else if (point.direction === SideName.West) {
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

interface SideMatch {
  side: SideName
  own: TileSideType
  adjacent?: TileSideType
  adjacentRowIndex: number
  adjacentTileIndex: number
}

/** Соседняя клетка по стороне тайла и сторона, с которой она соприкасается. */
export interface NeighborSide {
  side: SideName
  /** Смещение соседа относительно тайла: Y (строка) и X (колонка). */
  rowOffset: number
  columnOffset: number
  /** Сторона соседа, которой касается сторона `side` нового тайла. */
  oppositeSide: SideName
}

/**
 * Единственная таблица соседей доски. Сопоставление сторон всегда идёт по
 * именам направлений, а не по порядку ключей `sides`: порядок меняется при
 * повороте тайла.
 */
export const NEIGHBOR_SIDES: readonly NeighborSide[] = [
  {
    side: SideName.North,
    rowOffset: -1,
    columnOffset: 0,
    oppositeSide: SideName.South,
  },
  {
    side: SideName.East,
    rowOffset: 0,
    columnOffset: 1,
    oppositeSide: SideName.West,
  },
  {
    side: SideName.South,
    rowOffset: 1,
    columnOffset: 0,
    oppositeSide: SideName.North,
  },
  {
    side: SideName.West,
    rowOffset: 0,
    columnOffset: -1,
    oppositeSide: SideName.East,
  },
]

/** Координаты соседней клетки по стороне `side`. */
export function neighborCoordinates(
  rowIndex: number,
  tileIndex: number,
  neighbor: NeighborSide
): { rowIndex: number; tileIndex: number } {
  return {
    rowIndex: rowIndex + neighbor.rowOffset,
    tileIndex: tileIndex + neighbor.columnOffset,
  }
}

/** Центральная клетка доски: с неё начинается партия. */
export function boardCenterCoordinates(gridSize: number[]): {
  rowIndex: number
  tileIndex: number
} {
  return {
    rowIndex: Math.floor(gridSize[1] / 2),
    tileIndex: Math.floor(gridSize[0] / 2),
  }
}

/** Сопоставляет стороны нового тайла с противоположными сторонами соседей. */
function collectSideMatches(
  tile: Tile,
  rowIndex: number,
  tileIndex: number,
  tilePlacesStats: TilePlacesStats
): SideMatch[] {
  return NEIGHBOR_SIDES.map((neighbor) => {
    const coordinates = neighborCoordinates(rowIndex, tileIndex, neighbor)
    return {
      side: neighbor.side,
      own: tile.sides[neighbor.side],
      adjacent:
        tilePlacesStats[coordinates.rowIndex]?.[coordinates.tileIndex]?.sides[
          neighbor.oppositeSide
        ],
      adjacentRowIndex: coordinates.rowIndex,
      adjacentTileIndex: coordinates.tileIndex,
    }
  })
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

  const matches = collectSideMatches(tile, rowIndex, tileIndex, tilePlacesStats)

  if (!matches.some(({ adjacent }) => Boolean(adjacent))) {
    return false
  }

  return matches.every(({ adjacent, own }) => !adjacent || adjacent === own)
}

/**
 * Стороны нового тайла, не совпавшие со сторонами уже стоящих соседей.
 * Занятая клетка, отсутствие соседей и прочие причины отказа дают пустой
 * список: они описываются общим сообщением об ошибке.
 */
export function findTileSideConflicts(
  tile: Tile,
  rowIndex: number,
  tileIndex: number,
  tilePlacesStats: TilePlacesStats,
  isGridEmpty: boolean
): TileSideConflict[] {
  if (isGridEmpty) return []
  if (tilePlacesStats[rowIndex]?.[tileIndex]) return []

  const conflicts: TileSideConflict[] = []
  const matches = collectSideMatches(tile, rowIndex, tileIndex, tilePlacesStats)
  for (const match of matches) {
    if (!match.adjacent || match.adjacent === match.own) continue
    conflicts.push({
      side: match.side,
      rowIndex: match.adjacentRowIndex,
      tileIndex: match.adjacentTileIndex,
      own: match.own,
      adjacent: match.adjacent,
    })
  }

  return conflicts
}
