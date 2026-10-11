import { describe, expect, it } from 'vitest'
import { tiles } from '@server/data/tiles'
import { innsAndCathedralsTiles } from '@server/data/innsAndCathedralsTiles'
import { riverTiles } from '@server/data/riverTiles'
import { princessAndDragonTiles } from '@server/data/princessAndDragonTiles'
import {
  PointDirection,
  SideName,
  TileId,
  TileSideType,
} from '@server/modules/types'
import { getFollowerPosition, isTileId } from '@/utils/followerPositions'

// Наборы тайлов всех расширений: позиции фишек заданы и для речных тайлов,
// и для тайлов «Принцесса и дракон», поэтому проверяем их наравне с базовыми.
const tileSets = [
  ...tiles,
  ...innsAndCathedralsTiles,
  ...riverTiles,
  ...princessAndDragonTiles,
]
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
    tileSets.forEach((tile) => expect(isTileId(tile.id)).toBe(true))
  })

  it('maps every road and city entry to a matching side on the source tile', () => {
    for (const tile of tileSets) {
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
    for (const tile of tileSets) {
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

  // Точная позиция задана не для каждой стороны: без неё маркер ставится на
  // середину стороны в системе координат исходного тайла, а затем поворачивается
  // вместе с ним, поэтому остаётся на той же границе.
  it('falls back to the middle of the side without an explicit position', () => {
    // У тайла IAC_J город задан только для северной стороны.
    expect(
      getFollowerPosition(TileId.IAC_J, SideName.North, 0, TileSideType.City)
    ).toEqual([0.5, 0.24])

    expect(
      getFollowerPosition(TileId.IAC_J, SideName.North, 90, TileSideType.City)
    ).toEqual([0.5, 0.24])
    expect(
      getFollowerPosition(TileId.IAC_J, SideName.North, 180, TileSideType.City)
    ).toEqual([0.5, 0.24])

    // Дорога этого же тайла задана явно и поворот виден.
    expect(
      getFollowerPosition(TileId.IAC_J, SideName.South, 0, TileSideType.Road)
    ).toEqual([0.5, 0.82])
    expect(
      getFollowerPosition(TileId.IAC_J, SideName.South, 90, TileSideType.Road)
    ).toEqual([0.5, 0.76])
  })

  // Свой смещённый центр есть не у всех тайлов с садом; остальные рисуются
  // в общем центре, как и монастырь.
  it('keeps gardens without a tuned offset in the tile center', () => {
    expect(
      getFollowerPosition(
        TileId.IAC_H,
        PointDirection.Center,
        0,
        undefined,
        true
      )
    ).toEqual([0.5, 0.5])
    expect(
      getFollowerPosition(TileId.R, PointDirection.Center, 0, undefined, true)
    ).not.toEqual([0.5, 0.5])
  })

  // Точки без стороны или со стороной вне тайла не должны ронять отрисовку.
  it('falls back to the center for a missing or unknown direction', () => {
    expect(
      getFollowerPosition(TileId.X, undefined, 0, TileSideType.City)
    ).toEqual([0.5, 0.5])
    expect(
      getFollowerPosition(
        TileId.X,
        'nowhere' as unknown as typeof SideName.North,
        0,
        TileSideType.City
      )
    ).toEqual([0.5, 0.5])
  })
})
