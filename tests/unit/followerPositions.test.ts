import { describe, expect, it } from 'vitest'
import { tiles } from '@server/data/tiles'
import { innsAndCathedralsTiles } from '@server/data/innsAndCathedralsTiles'
import {
  PointDirection,
  SideName,
  TileId,
  TileSideType,
} from '@server/modules/types'
import { getFollowerPosition, isTileId } from '@/utils/followerPositions'

const allTiles = [...tiles, ...innsAndCathedralsTiles]
const tileIds = allTiles.map((tile) => tile.id)
const directions = [
  SideName.North,
  SideName.East,
  SideName.South,
  SideName.West,
] as const

function rotatePosition(
  [x, y]: readonly [number, number],
  rotation: number
): [number, number] {
  let rotatedPosition: [number, number]

  switch (rotation) {
    case 90:
      rotatedPosition = [1 - y, x]
      break
    case 180:
      rotatedPosition = [1 - x, 1 - y]
      break
    case 270:
      rotatedPosition = [y, 1 - x]
      break
    default:
      rotatedPosition = [x, y]
  }

  return rotatedPosition.map((coordinate) => Number(coordinate.toFixed(2))) as [
    number,
    number,
  ]
}

function getUnrotatedDirection(
  direction: (typeof directions)[number],
  rotation: number
): (typeof directions)[number] {
  const directionIndex = directions.indexOf(direction)
  const rotationSteps = rotation / 90
  return directions[(directionIndex - rotationSteps + 4) % 4] ?? direction
}

describe('follower positions', () => {
  it('has a position mapping for each base tile image', () => {
    expect(tiles).toHaveLength(24)
    expect(innsAndCathedralsTiles).toHaveLength(18)
    tileIds.forEach((tileId) => expect(isTileId(tileId)).toBe(true))
  })

  it('maps every road and city entry to a matching side on the source tile', () => {
    for (const tile of allTiles) {
      const tileId = tile.id as TileId
      for (const [direction, featureType] of Object.entries(tile.sides)) {
        if (
          featureType !== TileSideType.Road &&
          featureType !== TileSideType.City
        )
          continue

        const position = getFollowerPosition(
          tileId,
          direction as (typeof directions)[number],
          0,
          featureType
        )

        expect(
          position,
          `${tileId} ${direction} (${featureType})`
        ).toHaveLength(2)
        expect(position[0]).toBeGreaterThan(0.08)
        expect(position[0]).toBeLessThan(0.92)
        expect(position[1]).toBeGreaterThan(0.08)
        expect(position[1]).toBeLessThan(0.92)
      }
    }
  })

  it('rotates every road and city marker with its tile', () => {
    for (const tile of allTiles) {
      const tileId = tile.id as TileId
      for (const direction of directions) {
        const featureType = tile.sides[direction]
        if (
          featureType !== TileSideType.Road &&
          featureType !== TileSideType.City
        )
          continue

        for (const rotation of [0, 90, 180, 270]) {
          const unrotatedDirection = getUnrotatedDirection(direction, rotation)
          const basePosition = getFollowerPosition(
            tileId,
            unrotatedDirection,
            0,
            featureType
          )

          expect(
            getFollowerPosition(tileId, direction, rotation, featureType),
            `${tileId} ${direction} (${featureType}) at ${rotation}°`
          ).toEqual(rotatePosition(basePosition, rotation))
        }
      }
    }
  })

  it('rotates the follower position with the tile', () => {
    const basePosition = getFollowerPosition(
      TileId.V,
      SideName.South,
      0,
      TileSideType.Road
    )
    const clockwiseSidePosition = getFollowerPosition(
      TileId.V,
      SideName.West,
      90,
      TileSideType.Road
    )
    const halfTurnPosition = getFollowerPosition(
      TileId.V,
      SideName.North,
      180,
      TileSideType.Road
    )
    const counterClockwiseSidePosition = getFollowerPosition(
      TileId.V,
      SideName.East,
      270,
      TileSideType.Road
    )

    expect(basePosition).toEqual([0.5, 0.82])
    expect(clockwiseSidePosition).toEqual([0.18, 0.5])
    expect(halfTurnPosition).toEqual([0.5, 0.18])
    expect(counterClockwiseSidePosition).toEqual([0.82, 0.5])
  })

  it('places followers on separate city sections of tile I', () => {
    const topCityPosition = getFollowerPosition(
      TileId.I,
      SideName.North,
      0,
      TileSideType.City
    )
    const leftCityPosition = getFollowerPosition(
      TileId.I,
      SideName.West,
      0,
      TileSideType.City
    )
    const rotatedBottomCityPosition = getFollowerPosition(
      TileId.I,
      SideName.South,
      270,
      TileSideType.City
    )

    expect(topCityPosition).toEqual([0.5, 0.18])
    expect(leftCityPosition).toEqual([0.18, 0.5])
    expect(rotatedBottomCityPosition).toEqual([0.5, 0.82])
    expect(topCityPosition).not.toEqual(leftCityPosition)
  })

  it('puts monastery followers in the center and gardens off-center', () => {
    expect(
      getFollowerPosition(TileId.B, PointDirection.Center, 0, undefined)
    ).toEqual([0.5, 0.5])
    expect(
      getFollowerPosition(TileId.R, PointDirection.Center, 0, undefined, true)
    ).toEqual([0.5, 0.78])
  })

  it('rotates garden markers and rejects unknown tile ids', () => {
    expect(
      getFollowerPosition(TileId.R, PointDirection.Center, 90, undefined, true)
    ).toEqual([0.22, 0.5])
    expect(isTileId('unknown')).toBe(false)
  })
})
