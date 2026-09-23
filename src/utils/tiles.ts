import type { ITile } from '@/types/game'
import type { RotationDirection } from '@server/modules/types'
import type { TileSides } from '@server/modules/types'

export const TILE_SIZE = 115

export const normalizeRotation = (rotation: number): number =>
  ((rotation % 360) + 360) % 360

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
  if (direction === 'clockwise') {
    return {
      north: sides.west,
      west: sides.south,
      south: sides.east,
      east: sides.north,
    }
  }

  return {
    north: sides.east,
    west: sides.north,
    south: sides.west,
    east: sides.south,
  }
}

export const rotateTile = (
  tile: ITile,
  direction: RotationDirection
): ITile => ({
  ...tile,
  rotation: normalizeRotation(
    tile.rotation + (direction === 'clockwise' ? 90 : -90)
  ),
  sides: rotateSides(tile.sides, direction),
})
