import { describe, expect, it } from 'vitest'
import { rotateTileGroups, rotateTileSides } from '@server/modules/tileRotation'
import { SideName, TileSideType, type TileSides } from '@server/modules/types'

const sides: TileSides = {
  [SideName.North]: TileSideType.City,
  [SideName.East]: TileSideType.Road,
  [SideName.South]: TileSideType.Field,
  [SideName.West]: TileSideType.City,
}

describe('Поворот тайла на сервере', () => {
  it.each([
    [0, sides],
    [
      90,
      {
        [SideName.North]: TileSideType.City,
        [SideName.East]: TileSideType.City,
        [SideName.South]: TileSideType.Road,
        [SideName.West]: TileSideType.Field,
      },
    ],
    [
      180,
      {
        [SideName.North]: TileSideType.Field,
        [SideName.East]: TileSideType.City,
        [SideName.South]: TileSideType.City,
        [SideName.West]: TileSideType.Road,
      },
    ],
    [
      270,
      {
        [SideName.North]: TileSideType.Road,
        [SideName.East]: TileSideType.Field,
        [SideName.South]: TileSideType.City,
        [SideName.West]: TileSideType.City,
      },
    ],
  ] as const)('поворачивает стороны на %i градусов', (rotation, expected) => {
    expect(rotateTileSides(sides, rotation / 90)).toEqual(expected)
  })

  it.each([
    [0, [[SideName.North, SideName.East], [SideName.South]]],
    [1, [[SideName.East, SideName.South], [SideName.West]]],
    [2, [[SideName.South, SideName.West], [SideName.North]]],
    [3, [[SideName.West, SideName.North], [SideName.East]]],
  ] as const)(
    'поворачивает связанные группы на %i четверти',
    (turns, expected) => {
      const groups = [[SideName.North, SideName.East], [SideName.South]]

      expect(rotateTileGroups(groups, turns)).toEqual(expected)
    }
  )

  it('нормализует отрицательные и полные обороты, не мутируя входные данные', () => {
    const originalGroups = [[SideName.North, SideName.West]]

    expect(rotateTileSides(sides, -1)).toEqual(rotateTileSides(sides, 3))
    expect(rotateTileSides(sides, 4)).toEqual(sides)
    expect(rotateTileGroups(originalGroups, -1)).toEqual([
      [SideName.West, SideName.South],
    ])
    expect(originalGroups).toEqual([[SideName.North, SideName.West]])
    expect(rotateTileGroups(undefined, 1)).toBeUndefined()
  })
})
