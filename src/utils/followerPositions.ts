import type { PointDirection, PointType } from '@server/modules/types'

export type SideDirection = Exclude<PointDirection, 'center'>
export type TileId =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'

type Position = [number, number]
type FeaturePositions = Partial<Record<SideDirection, Position>>

const sideDirections: SideDirection[] = ['north', 'east', 'south', 'west']

// Позиции заданы на исходных изображениях тайлов; ниже они преобразуются
// в координаты уже повернутого тайла для отрисовки маркера.
const roadPositions: Record<TileId, FeaturePositions> = {
  A: { south: [0.5, 0.82] },
  B: {},
  C: {},
  D: { east: [0.5, 0.5], west: [0.5, 0.5] },
  E: {},
  F: {},
  G: {},
  H: {},
  I: {},
  J: { east: [0.82, 0.5], south: [0.5, 0.82] },
  K: { south: [0.5, 0.82], west: [0.18, 0.5] },
  L: { east: [0.82, 0.5], south: [0.5, 0.82], west: [0.18, 0.5] },
  M: {},
  N: {},
  O: { east: [0.82, 0.5], south: [0.5, 0.82] },
  P: { east: [0.82, 0.5], south: [0.5, 0.82] },
  Q: {},
  R: {},
  S: { south: [0.5, 0.82] },
  T: { south: [0.5, 0.82] },
  U: { north: [0.5, 0.5], south: [0.5, 0.5] },
  V: { south: [0.5, 0.82], west: [0.18, 0.5] },
  W: { east: [0.82, 0.5], south: [0.5, 0.82], west: [0.18, 0.5] },
  X: {
    north: [0.5, 0.18],
    east: [0.82, 0.5],
    south: [0.5, 0.82],
    west: [0.18, 0.5],
  },
}

const cityPositions: Record<TileId, FeaturePositions> = {
  A: {},
  B: {},
  C: {
    north: [0.5, 0.5],
    east: [0.5, 0.5],
    south: [0.5, 0.5],
    west: [0.5, 0.5],
  },
  D: { north: [0.5, 0.18] },
  E: { north: [0.5, 0.18] },
  F: { east: [0.5, 0.5], west: [0.5, 0.5] },
  G: { east: [0.5, 0.5], west: [0.5, 0.5] },
  H: { north: [0.5, 0.18], south: [0.5, 0.82] },
  I: { north: [0.5, 0.18], west: [0.18, 0.5] },
  J: { north: [0.5, 0.18] },
  K: { north: [0.5, 0.18] },
  L: { north: [0.5, 0.18] },
  M: { north: [0.76, 0.24], east: [0.76, 0.24] },
  N: { north: [0.76, 0.24], east: [0.76, 0.24] },
  O: { north: [0.24, 0.24], west: [0.24, 0.24] },
  P: { north: [0.24, 0.24], west: [0.24, 0.24] },
  Q: { north: [0.5, 0.3], east: [0.5, 0.3], west: [0.5, 0.3] },
  R: { north: [0.5, 0.3], east: [0.5, 0.3], west: [0.5, 0.3] },
  S: { north: [0.5, 0.3], east: [0.5, 0.3], west: [0.5, 0.3] },
  T: { north: [0.5, 0.3], east: [0.5, 0.3], west: [0.5, 0.3] },
  U: {},
  V: {},
  W: {},
  X: {},
}

const gardenPositions: Partial<Record<TileId, Position>> = {
  E: [0.5, 0.78],
  H: [0.5, 0.5],
  I: [0.74, 0.74],
  M: [0.26, 0.74],
  N: [0.26, 0.74],
  R: [0.5, 0.78],
  U: [0.74, 0.5],
  V: [0.74, 0.3],
}

function getCanonicalDirection(
  direction: SideDirection,
  rotation: number
): SideDirection {
  const directionIndex = sideDirections.indexOf(direction)
  const rotationSteps = Math.round(rotation / 90)
  const baseIndex = (directionIndex - rotationSteps + 4) % 4
  return sideDirections[baseIndex] ?? direction
}

function rotatePosition([x, y]: Position, rotation: number): Position {
  const rotationSteps = ((Math.round(rotation / 90) % 4) + 4) % 4
  let rotatedPosition: Position

  switch (rotationSteps) {
    case 1:
      rotatedPosition = [1 - y, x]
      break
    case 2:
      rotatedPosition = [1 - x, 1 - y]
      break
    case 3:
      rotatedPosition = [y, 1 - x]
      break
    default:
      rotatedPosition = [x, y]
  }

  return [
    Number(rotatedPosition[0].toFixed(2)),
    Number(rotatedPosition[1].toFixed(2)),
  ]
}

export function getFollowerPosition(
  tileId: TileId,
  direction: PointDirection | undefined,
  rotation: number,
  pointType: PointType | undefined,
  isGarden = false
): Position {
  if (direction === 'center') {
    const position: Position = isGarden
      ? (gardenPositions[tileId] ?? [0.5, 0.5])
      : [0.5, 0.5]
    return rotatePosition(position, rotation)
  }

  if (!direction || !sideDirections.includes(direction)) return [0.5, 0.5]

  const featureDirection = getCanonicalDirection(direction, rotation)
  const positions = pointType === 'road' ? roadPositions : cityPositions
  const featurePosition = positions[tileId][featureDirection]

  const edgePositions: Record<SideDirection, Position> = {
    north: [0.5, 0.24],
    east: [0.76, 0.5],
    south: [0.5, 0.76],
    west: [0.24, 0.5],
  }
  return rotatePosition(
    featurePosition ?? edgePositions[featureDirection],
    rotation
  )
}

export function isTileId(tileId: string): tileId is TileId {
  return Object.hasOwn(roadPositions, tileId)
}
