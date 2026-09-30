import {
  PointDirection,
  SideName,
  TileSideType,
  TileRotation,
  TileId,
  type PointType,
} from '@server/modules/types'

export type SideDirection = Exclude<
  PointDirection,
  typeof PointDirection.Center
>
type Position = readonly [number, number]
type FeaturePositions = Partial<Record<SideDirection, Position>>

const sideDirections: SideDirection[] = [
  SideName.North,
  SideName.East,
  SideName.South,
  SideName.West,
]

// Позиции заданы на исходных изображениях тайлов; ниже они преобразуются
// в координаты уже повернутого тайла для отрисовки маркера.
const roadPositions: Record<TileId, FeaturePositions> = {
  [TileId.A]: { [SideName.South]: [0.5, 0.82] },
  [TileId.B]: {},
  [TileId.C]: {},
  [TileId.D]: { [SideName.East]: [0.5, 0.5], [SideName.West]: [0.5, 0.5] },
  [TileId.E]: {},
  [TileId.F]: {},
  [TileId.G]: {},
  [TileId.H]: {},
  [TileId.I]: {},
  [TileId.J]: { [SideName.East]: [0.82, 0.5], [SideName.South]: [0.5, 0.82] },
  [TileId.K]: { [SideName.South]: [0.5, 0.82], [SideName.West]: [0.18, 0.5] },
  [TileId.L]: {
    [SideName.East]: [0.82, 0.5],
    [SideName.South]: [0.5, 0.82],
    [SideName.West]: [0.18, 0.5],
  },
  [TileId.M]: {},
  [TileId.N]: {},
  [TileId.O]: { [SideName.East]: [0.82, 0.5], [SideName.South]: [0.5, 0.82] },
  [TileId.P]: { [SideName.East]: [0.82, 0.5], [SideName.South]: [0.5, 0.82] },
  [TileId.Q]: {},
  [TileId.R]: {},
  [TileId.S]: { [SideName.South]: [0.5, 0.82] },
  [TileId.T]: { [SideName.South]: [0.5, 0.82] },
  [TileId.U]: { [SideName.North]: [0.5, 0.5], [SideName.South]: [0.5, 0.5] },
  [TileId.V]: { [SideName.South]: [0.5, 0.82], [SideName.West]: [0.18, 0.5] },
  [TileId.W]: {
    [SideName.East]: [0.82, 0.5],
    [SideName.South]: [0.5, 0.82],
    [SideName.West]: [0.18, 0.5],
  },
  [TileId.X]: {
    [SideName.North]: [0.5, 0.18],
    [SideName.East]: [0.82, 0.5],
    [SideName.South]: [0.5, 0.82],
    [SideName.West]: [0.18, 0.5],
  },
  [TileId.IAC_A]: {
    [SideName.South]: [0.5, 0.82],
    [SideName.West]: [0.18, 0.5],
  },
  [TileId.IAC_B]: { [SideName.East]: [0.5, 0.5], [SideName.West]: [0.5, 0.5] },
  [TileId.IAC_C]: {
    [SideName.East]: [0.82, 0.5],
    [SideName.South]: [0.5, 0.82],
    [SideName.West]: [0.18, 0.5],
  },
  [TileId.IAC_D]: {},
  [TileId.IAC_E]: {
    [SideName.North]: [0.5, 0.18],
    [SideName.South]: [0.5, 0.82],
  },
  [TileId.IAC_F]: { [SideName.East]: [0.82, 0.5] },
  [TileId.IAC_G]: {},
  [TileId.IAC_H]: {},
  [TileId.IAC_I]: {
    [SideName.East]: [0.82, 0.5],
    [SideName.West]: [0.18, 0.5],
  },
  [TileId.IAC_J]: {
    [SideName.South]: [0.5, 0.82],
    [SideName.West]: [0.18, 0.5],
  },
  [TileId.IAC_Ka]: {},
  [TileId.IAC_Kb]: {},
  [TileId.IAC_L]: { [SideName.East]: [0.82, 0.5] },
  [TileId.IAC_M]: {
    [SideName.South]: [0.5, 0.82],
    [SideName.West]: [0.18, 0.5],
  },
  [TileId.IAC_N]: {
    [SideName.East]: [0.82, 0.5],
    [SideName.South]: [0.5, 0.82],
  },
  [TileId.IAC_O]: {
    [SideName.North]: [0.5, 0.18],
    [SideName.East]: [0.82, 0.5],
  },
  [TileId.IAC_P]: {},
  [TileId.IAC_Q]: {},
  [TileId.RIVER_A]: {},
  [TileId.RIVER_B]: {},
  [TileId.RIVER_C]: {},
  [TileId.RIVER_D]: {},
  [TileId.RIVER_F]: {},
  [TileId.RIVER_G]: {},
  [TileId.RIVER_H]: { [SideName.West]: [0.18, 0.5] },
  [TileId.RIVER_I]: { [SideName.North]: [0.5, 0.18] },
  [TileId.RIVER_J]: {},
  [TileId.RIVER_K]: {
    [SideName.East]: [0.82, 0.5],
    [SideName.West]: [0.18, 0.5],
  },
  [TileId.RIVER_L]: {},
}

const cityPositions: Record<TileId, FeaturePositions> = {
  [TileId.A]: {},
  [TileId.B]: {},
  [TileId.C]: {
    [SideName.North]: [0.5, 0.5],
    [SideName.East]: [0.5, 0.5],
    [SideName.South]: [0.5, 0.5],
    [SideName.West]: [0.5, 0.5],
  },
  [TileId.D]: { [SideName.North]: [0.5, 0.18] },
  [TileId.E]: { [SideName.North]: [0.5, 0.18] },
  [TileId.F]: { [SideName.East]: [0.5, 0.5], [SideName.West]: [0.5, 0.5] },
  [TileId.G]: { [SideName.East]: [0.5, 0.5], [SideName.West]: [0.5, 0.5] },
  [TileId.H]: { [SideName.North]: [0.5, 0.18], [SideName.South]: [0.5, 0.82] },
  [TileId.I]: { [SideName.North]: [0.5, 0.18], [SideName.West]: [0.18, 0.5] },
  [TileId.J]: { [SideName.North]: [0.5, 0.18] },
  [TileId.K]: { [SideName.North]: [0.5, 0.18] },
  [TileId.L]: { [SideName.North]: [0.5, 0.18] },
  [TileId.M]: { [SideName.North]: [0.76, 0.24], [SideName.East]: [0.76, 0.24] },
  [TileId.N]: { [SideName.North]: [0.76, 0.24], [SideName.East]: [0.76, 0.24] },
  [TileId.O]: { [SideName.North]: [0.24, 0.24], [SideName.West]: [0.24, 0.24] },
  [TileId.P]: { [SideName.North]: [0.24, 0.24], [SideName.West]: [0.24, 0.24] },
  [TileId.Q]: {
    [SideName.North]: [0.5, 0.3],
    [SideName.East]: [0.5, 0.3],
    [SideName.West]: [0.5, 0.3],
  },
  [TileId.R]: {
    [SideName.North]: [0.5, 0.3],
    [SideName.East]: [0.5, 0.3],
    [SideName.West]: [0.5, 0.3],
  },
  [TileId.S]: {
    [SideName.North]: [0.5, 0.3],
    [SideName.East]: [0.5, 0.3],
    [SideName.West]: [0.5, 0.3],
  },
  [TileId.T]: {
    [SideName.North]: [0.5, 0.3],
    [SideName.East]: [0.5, 0.3],
    [SideName.West]: [0.5, 0.3],
  },
  [TileId.U]: {},
  [TileId.V]: {},
  [TileId.W]: {},
  [TileId.X]: {},
  [TileId.IAC_A]: {},
  [TileId.IAC_B]: {},
  [TileId.IAC_C]: {},
  [TileId.IAC_D]: {},
  [TileId.IAC_E]: {},
  [TileId.IAC_F]: {
    [SideName.North]: [0.5, 0.18],
    [SideName.West]: [0.18, 0.5],
  },
  [TileId.IAC_G]: { [SideName.North]: [0.5, 0.18] },
  [TileId.IAC_H]: {
    [SideName.North]: [0.5, 0.18],
    [SideName.East]: [0.76, 0.5],
    [SideName.South]: [0.5, 0.82],
    [SideName.West]: [0.24, 0.5],
  },
  [TileId.IAC_I]: {
    [SideName.North]: [0.5, 0.18],
    [SideName.South]: [0.5, 0.82],
  },
  [TileId.IAC_J]: {},
  [TileId.IAC_Ka]: {
    [SideName.North]: [0.5, 0.18],
    [SideName.East]: [0.76, 0.5],
    [SideName.South]: [0.5, 0.82],
    [SideName.West]: [0.24, 0.5],
  },
  [TileId.IAC_Kb]: {
    [SideName.North]: [0.5, 0.18],
    [SideName.East]: [0.76, 0.5],
    [SideName.South]: [0.5, 0.82],
    [SideName.West]: [0.24, 0.5],
  },
  [TileId.IAC_L]: {
    [SideName.North]: [0.24, 0.24],
    [SideName.West]: [0.24, 0.24],
  },
  [TileId.IAC_M]: {},
  [TileId.IAC_N]: {},
  [TileId.IAC_O]: {},
  [TileId.IAC_P]: {
    [SideName.North]: [0.5, 0.18],
    [SideName.East]: [0.76, 0.5],
    [SideName.South]: [0.5, 0.82],
    [SideName.West]: [0.24, 0.5],
  },
  [TileId.IAC_Q]: {
    [SideName.North]: [0.5, 0.18],
    [SideName.East]: [0.76, 0.5],
    [SideName.West]: [0.24, 0.5],
  },
  [TileId.RIVER_A]: {},
  [TileId.RIVER_B]: { [SideName.North]: [0.5, 0.18] },
  [TileId.RIVER_C]: {
    [SideName.North]: [0.5, 0.18],
    [SideName.South]: [0.5, 0.82],
  },
  [TileId.RIVER_D]: {},
  [TileId.RIVER_F]: {},
  [TileId.RIVER_G]: {},
  [TileId.RIVER_H]: {},
  [TileId.RIVER_I]: {},
  [TileId.RIVER_J]: {},
  [TileId.RIVER_K]: {},
  [TileId.RIVER_L]: {},
}

const gardenPositions: Partial<Record<TileId, Position>> = {
  [TileId.E]: [0.5, 0.78],
  [TileId.H]: [0.5, 0.5],
  [TileId.I]: [0.74, 0.74],
  [TileId.M]: [0.26, 0.74],
  [TileId.N]: [0.26, 0.74],
  [TileId.R]: [0.5, 0.78],
  [TileId.U]: [0.74, 0.5],
  [TileId.V]: [0.74, 0.3],
}

function getCanonicalDirection(
  direction: SideDirection,
  rotation: number
): SideDirection {
  const directionIndex = sideDirections.indexOf(direction)
  const rotationSteps = Math.round(rotation / TileRotation.QuarterTurn)
  const turnCount = TileRotation.FullTurn / TileRotation.QuarterTurn
  const baseIndex = (directionIndex - rotationSteps + turnCount) % turnCount
  return sideDirections[baseIndex] ?? direction
}

function rotatePosition([x, y]: Position, rotation: number): Position {
  const turnCount = TileRotation.FullTurn / TileRotation.QuarterTurn
  const rotationSteps =
    ((Math.round(rotation / TileRotation.QuarterTurn) % turnCount) +
      turnCount) %
    turnCount
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
  if (direction === PointDirection.Center) {
    const position: Position = isGarden
      ? (gardenPositions[tileId] ?? [0.5, 0.5])
      : [0.5, 0.5]
    return rotatePosition(position, rotation)
  }

  if (!direction || !sideDirections.includes(direction)) return [0.5, 0.5]

  const featureDirection = getCanonicalDirection(direction, rotation)
  const positions =
    pointType === TileSideType.Road ? roadPositions : cityPositions
  const featurePosition = positions[tileId][featureDirection]

  const edgePositions: Record<SideDirection, Position> = {
    [SideName.North]: [0.5, 0.24],
    [SideName.East]: [0.76, 0.5],
    [SideName.South]: [0.5, 0.76],
    [SideName.West]: [0.24, 0.5],
  }
  return rotatePosition(
    featurePosition ?? edgePositions[featureDirection],
    rotation
  )
}

export function isTileId(tileId: string): tileId is TileId {
  return Object.values(TileId).some((knownTileId) => knownTileId === tileId)
}
