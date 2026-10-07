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

/** Сопоставляет стороны нового тайла с противоположными сторонами соседей. */
function collectSideMatches(
  tile: Tile,
  rowIndex: number,
  tileIndex: number,
  tilePlacesStats: TilePlacesStats
): SideMatch[] {
  // Сопоставляем стороны явно: порядок ключей sides может меняться при повороте.
  const neighbours: Array<{
    side: SideName
    neighbourSide: SideName
    neighbourRowIndex: number
    neighbourTileIndex: number
  }> = [
    {
      side: SideName.North,
      neighbourSide: SideName.South,
      neighbourRowIndex: rowIndex - 1,
      neighbourTileIndex: tileIndex,
    },
    {
      side: SideName.East,
      neighbourSide: SideName.West,
      neighbourRowIndex: rowIndex,
      neighbourTileIndex: tileIndex + 1,
    },
    {
      side: SideName.South,
      neighbourSide: SideName.North,
      neighbourRowIndex: rowIndex + 1,
      neighbourTileIndex: tileIndex,
    },
    {
      side: SideName.West,
      neighbourSide: SideName.East,
      neighbourRowIndex: rowIndex,
      neighbourTileIndex: tileIndex - 1,
    },
  ]

  return neighbours.map((neighbour) => ({
    side: neighbour.side,
    own: tile.sides[neighbour.side],
    adjacent:
      tilePlacesStats[neighbour.neighbourRowIndex]?.[
        neighbour.neighbourTileIndex
      ]?.sides[neighbour.neighbourSide],
    adjacentRowIndex: neighbour.neighbourRowIndex,
    adjacentTileIndex: neighbour.neighbourTileIndex,
  }))
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
