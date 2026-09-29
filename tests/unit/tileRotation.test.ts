import { describe, expect, it } from 'vitest'
import {
  rotateTileGroups,
  rotateTileSides,
} from '../../server/src/modules/tileRotation'
import type { TileSides } from '../../server/src/modules/types'

const sides: TileSides = {
  north: 'city',
  east: 'road',
  south: 'field',
  west: 'city',
}

describe('Поворот тайла на сервере', () => {
  it.each([
    [0, sides],
    [90, { north: 'city', east: 'city', south: 'road', west: 'field' }],
    [180, { north: 'field', east: 'city', south: 'city', west: 'road' }],
    [270, { north: 'road', east: 'field', south: 'city', west: 'city' }],
  ] as const)('поворачивает стороны на %i градусов', (rotation, expected) => {
    expect(rotateTileSides(sides, rotation / 90)).toEqual(expected)
  })

  it('поворачивает связанные группы сторон на тот же угол', () => {
    const groups = [['north', 'east'], ['south']] as const

    expect(
      rotateTileGroups(
        groups.map((group) => [...group]),
        0
      )
    ).toEqual([['north', 'east'], ['south']])
    expect(
      rotateTileGroups(
        groups.map((group) => [...group]),
        1
      )
    ).toEqual([['east', 'south'], ['west']])
    expect(
      rotateTileGroups(
        groups.map((group) => [...group]),
        2
      )
    ).toEqual([['south', 'west'], ['north']])
    expect(
      rotateTileGroups(
        groups.map((group) => [...group]),
        3
      )
    ).toEqual([['west', 'north'], ['east']])
  })

  it('нормализует отрицательные и полные обороты, не мутируя входные данные', () => {
    const originalGroups = [['north', 'west']]

    expect(rotateTileSides(sides, -1)).toEqual(rotateTileSides(sides, 3))
    expect(rotateTileSides(sides, 4)).toEqual(sides)
    expect(rotateTileGroups(originalGroups, -1)).toEqual([['west', 'south']])
    expect(originalGroups).toEqual([['north', 'west']])
    expect(rotateTileGroups(undefined, 1)).toBeUndefined()
  })
})
