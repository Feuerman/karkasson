import {
  SideName,
  type SideName as SideNameValue,
  type Tile,
  type TileSides,
} from './types'

const CLOCKWISE_SIDE: Record<SideNameValue, SideNameValue> = {
  [SideName.North]: SideName.East,
  [SideName.East]: SideName.South,
  [SideName.South]: SideName.West,
  [SideName.West]: SideName.North,
}

export function rotateTileSides(
  sides: TileSides,
  quarterTurns: number
): TileSides {
  let rotatedSides = { ...sides }
  const turnCount = 360 / 90
  const turns = ((quarterTurns % turnCount) + turnCount) % turnCount

  for (let turn = 0; turn < turns; turn++) {
    rotatedSides = {
      [SideName.North]: rotatedSides[SideName.West],
      [SideName.East]: rotatedSides[SideName.North],
      [SideName.South]: rotatedSides[SideName.East],
      [SideName.West]: rotatedSides[SideName.South],
    }
  }

  return rotatedSides
}

export function rotateTileGroups(
  groups: SideNameValue[][] | undefined,
  quarterTurns: number
): SideNameValue[][] | undefined {
  if (!groups) return groups

  const turnCount = 360 / 90
  const turns = ((quarterTurns % turnCount) + turnCount) % turnCount
  return groups
    .map((group) =>
      group.map((side) => {
        let rotatedSide = side
        for (let turn = 0; turn < turns; turn++) {
          rotatedSide = CLOCKWISE_SIDE[rotatedSide]
        }
        return rotatedSide
      })
    )
    .filter((group) => group.length > 0)
}

/**
 * Поворачивает стороны тайла и все группы соединений на целое число четвертей.
 * Стороны и группы всегда поворачиваются вместе: иначе объект на доске
 * перестал бы совпадать с рисунком тайла.
 */
export function applyQuarterTurns(tile: Tile, quarterTurns: number): Tile {
  const rotated: Tile = { ...tile }
  rotated.sides = rotateTileSides(tile.sides, quarterTurns)
  rotated.roadGroups = rotateTileGroups(tile.roadGroups, quarterTurns)
  rotated.cityGroups = rotateTileGroups(tile.cityGroups, quarterTurns)
  rotated.cityShieldGroups = rotateTileGroups(
    tile.cityShieldGroups,
    quarterTurns
  )
  rotated.riverGroups = rotateTileGroups(tile.riverGroups, quarterTurns)
  return rotated
}
