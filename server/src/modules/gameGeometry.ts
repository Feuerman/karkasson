import {
  OPPOSITE_SIDE,
  SideName,
  TileSideType,
  isRiverPlacementConflict,
  type PlacementConflict,
  type Point,
  type RiverPlacementConflict,
  type Tile,
  type TilePlacesStats,
  type TileSideConflict,
} from './types'

export const PLACEMENT_FAILURE_MESSAGE =
  'Невозможно разместить тайл на данной позиции'

const SIDE_LABELS: Record<SideName, string> = {
  [SideName.North]: 'север',
  [SideName.East]: 'восток',
  [SideName.South]: 'юг',
  [SideName.West]: 'запад',
}

const SIDE_GENITIVE_LABELS: Record<SideName, string> = {
  [SideName.North]: 'севера',
  [SideName.East]: 'востока',
  [SideName.South]: 'юга',
  [SideName.West]: 'запада',
}

const SIDE_TYPE_LABELS: Record<TileSideType, string> = {
  [TileSideType.Field]: 'поле',
  [TileSideType.Road]: 'дорога',
  [TileSideType.City]: 'город',
}

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

/** Подробное сообщение об отказе разместить тайл. */
export function describePlacementConflicts(
  conflicts: TileSideConflict[]
): string {
  if (!conflicts.length) return PLACEMENT_FAILURE_MESSAGE

  const details = conflicts
    .map(
      ({ side, own, adjacent }) =>
        `${SIDE_LABELS[side]} — ${SIDE_TYPE_LABELS[own]}, а у соседа с ` +
        `${SIDE_GENITIVE_LABELS[OPPOSITE_SIDE[side]]} — ` +
        `${SIDE_TYPE_LABELS[adjacent]}`
    )
    .join('; ')

  return `${PLACEMENT_FAILURE_MESSAGE}: ${details}.`
}

/** Подробное сообщение об отказе по правилам реки. */
export function describeRiverConflict(
  conflict: RiverPlacementConflict
): string {
  const detail =
    conflict.reason === 'openEnd'
      ? 'река — незакрытый конец русла у соседнего тайла'
      : 'река — русло этого тайла выходит не в ту сторону'

  return `${PLACEMENT_FAILURE_MESSAGE}: ${detail}.`
}

/** Сообщение о причине неудачного размещения по конфликтам диагностики. */
export function describePlacementFailure(
  conflicts: PlacementConflict[]
): string {
  const sideConflicts: TileSideConflict[] = []
  for (const conflict of conflicts) {
    if (isRiverPlacementConflict(conflict)) {
      return describeRiverConflict(conflict)
    }
    sideConflicts.push(conflict)
  }

  return describePlacementConflicts(sideConflicts)
}
