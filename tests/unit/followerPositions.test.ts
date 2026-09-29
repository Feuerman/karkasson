import { describe, expect, it } from 'vitest'
import { tiles } from '../../server/src/data/tiles'
import { innsAndCathedralsTiles } from '../../server/src/data/innsAndCathedralsTiles'
import {
  getFollowerPosition,
  isTileId,
  type TileId,
} from '../../src/utils/followerPositions'

const allTiles = [...tiles, ...innsAndCathedralsTiles]
const tileIds = allTiles.map((tile) => tile.id)
const directions = ['north', 'east', 'south', 'west'] as const

function rotatePosition(
  [x, y]: [number, number],
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
        if (featureType !== 'road' && featureType !== 'city') continue

        const position = getFollowerPosition(
          tileId,
          direction as 'north' | 'east' | 'south' | 'west',
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
        if (featureType !== 'road' && featureType !== 'city') continue

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
    const basePosition = getFollowerPosition('V', 'south', 0, 'road')
    const clockwiseSidePosition = getFollowerPosition('V', 'west', 90, 'road')
    const halfTurnPosition = getFollowerPosition('V', 'north', 180, 'road')
    const counterClockwiseSidePosition = getFollowerPosition(
      'V',
      'east',
      270,
      'road'
    )

    expect(basePosition).toEqual([0.5, 0.82])
    expect(clockwiseSidePosition).toEqual([0.18, 0.5])
    expect(halfTurnPosition).toEqual([0.5, 0.18])
    expect(counterClockwiseSidePosition).toEqual([0.82, 0.5])
  })

  it('places followers on separate city sections of tile I', () => {
    const topCityPosition = getFollowerPosition('I', 'north', 0, 'city')
    const leftCityPosition = getFollowerPosition('I', 'west', 0, 'city')
    const rotatedBottomCityPosition = getFollowerPosition(
      'I',
      'south',
      270,
      'city'
    )

    expect(topCityPosition).toEqual([0.5, 0.18])
    expect(leftCityPosition).toEqual([0.18, 0.5])
    expect(rotatedBottomCityPosition).toEqual([0.5, 0.82])
    expect(topCityPosition).not.toEqual(leftCityPosition)
  })

  it('puts monastery followers in the center and gardens off-center', () => {
    expect(getFollowerPosition('B', 'center', 0, undefined)).toEqual([0.5, 0.5])
    expect(getFollowerPosition('R', 'center', 0, undefined, true)).toEqual([
      0.5, 0.78,
    ])
  })

  it('rotates garden markers and rejects unknown tile ids', () => {
    expect(getFollowerPosition('R', 'center', 90, undefined, true)).toEqual([
      0.22, 0.5,
    ])
    expect(isTileId('unknown')).toBe(false)
  })
})
