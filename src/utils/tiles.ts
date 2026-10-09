import type { ITile } from '@/types/game'
import {
  RotationDirection as RotationDirections,
  SideName,
  type RotationDirection,
  type TileSides,
} from '@server/modules/types'

export const TILE_SIZE = 115
const FULL_ROTATION_DEGREES = 360

export const normalizeRotation = (rotation: number): number =>
  ((rotation % FULL_ROTATION_DEGREES) + FULL_ROTATION_DEGREES) %
  FULL_ROTATION_DEGREES

const ROTATION_CLASSES: Record<number, string> = {
  0: 'rotate-0',
  90: 'rotate-90',
  180: 'rotate-180',
  270: 'rotate-270',
}

export const rotationClass = (rotation: number): string =>
  ROTATION_CLASSES[normalizeRotation(rotation)] ?? 'rotate-0'

const rotateSides = (
  sides: TileSides,
  direction: RotationDirection
): TileSides => {
  if (direction === RotationDirections.Clockwise) {
    return {
      [SideName.North]: sides[SideName.West],
      [SideName.West]: sides[SideName.South],
      [SideName.South]: sides[SideName.East],
      [SideName.East]: sides[SideName.North],
    }
  }

  return {
    [SideName.North]: sides[SideName.East],
    [SideName.West]: sides[SideName.North],
    [SideName.South]: sides[SideName.West],
    [SideName.East]: sides[SideName.South],
  }
}

export const rotateTile = (
  tile: ITile,
  direction: RotationDirection
): ITile => ({
  ...tile,
  rotation: normalizeRotation(
    tile.rotation + (direction === RotationDirections.Clockwise ? 90 : -90)
  ),
  sides: rotateSides(tile.sides, direction),
})
