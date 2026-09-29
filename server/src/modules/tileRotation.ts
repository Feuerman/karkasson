import type { SideName, TileSides } from './types'

const CLOCKWISE_SIDE: Record<SideName, SideName> = {
  north: 'east',
  east: 'south',
  south: 'west',
  west: 'north',
}

export function rotateTileSides(
  sides: TileSides,
  quarterTurns: number
): TileSides {
  let rotatedSides = { ...sides }
  const turns = ((quarterTurns % 4) + 4) % 4

  for (let turn = 0; turn < turns; turn++) {
    rotatedSides = {
      north: rotatedSides.west,
      east: rotatedSides.north,
      south: rotatedSides.east,
      west: rotatedSides.south,
    }
  }

  return rotatedSides
}

export function rotateTileGroups(
  groups: SideName[][] | undefined,
  quarterTurns: number
): SideName[][] | undefined {
  if (!groups) return groups

  const turns = ((quarterTurns % 4) + 4) % 4
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
