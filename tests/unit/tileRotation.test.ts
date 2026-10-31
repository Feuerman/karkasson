import { describe, expect, it } from 'vitest'
import {
  rotateFieldPort,
  rotateFieldTopology,
  rotateTileGroups,
  rotateTileSides,
} from '@server/modules/tileRotation'
import { SideName, TileSideType, type TileSides } from '@server/modules/types'
import type {
  FieldBoundaryPort,
  FieldRegionDefinition,
} from '@server/data/fieldTopology'

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

describe('Поворот портов поля на сервере', () => {
  const port: FieldBoundaryPort = 'northWest'

  it.each([
    [0, 'northWest'],
    [1, 'eastNorth'],
    [2, 'southEast'],
    [3, 'westSouth'],
    [4, 'northWest'],
    [-1, 'westSouth'],
  ] as const)(
    'поворачивает northWest на %i четвертей -> %s',
    (turns, expected) => {
      expect(rotateFieldPort(port, turns)).toBe(expected)
    }
  )

  it.each<[FieldBoundaryPort, FieldBoundaryPort]>([
    ['northWest', 'eastNorth'],
    ['northEast', 'eastSouth'],
    ['eastNorth', 'southEast'],
    ['eastSouth', 'southWest'],
    ['southEast', 'westSouth'],
    ['southWest', 'westNorth'],
    ['westSouth', 'northWest'],
    ['westNorth', 'northEast'],
  ])('90 градусов по часовой: %s -> %s', (input, expected) => {
    expect(rotateFieldPort(input, 1)).toBe(expected)
  })

  it('обратный поворот восстанавливает исходные порты', () => {
    const topology: FieldRegionDefinition[] = [
      { boundaryPorts: ['northWest', 'westNorth'], adjacentCityGroups: [0] },
      { boundaryPorts: ['eastNorth', 'eastSouth'], adjacentCityGroups: [1] },
    ]

    const rotated90 = rotateFieldTopology(topology, 1)
    const rotatedBack = rotateFieldTopology(rotated90 ?? [], 3)

    expect(rotatedBack).toEqual([
      { boundaryPorts: ['northWest', 'westNorth'], adjacentCityGroups: [0] },
      { boundaryPorts: ['eastNorth', 'eastSouth'], adjacentCityGroups: [1] },
    ])
  })

  it('180 градусов отражает порты через центр', () => {
    const topology: FieldRegionDefinition[] = [
      { boundaryPorts: ['northWest', 'westNorth'], adjacentCityGroups: [0] },
    ]

    const rotated = rotateFieldTopology(topology, 2)
    expect(rotated).toEqual([
      { boundaryPorts: ['southEast', 'eastSouth'], adjacentCityGroups: [0] },
    ])
  })

  it('не мутирует исходную топологию и возвращает её при 0', () => {
    const topology: FieldRegionDefinition[] = [
      { boundaryPorts: ['northWest'], adjacentCityGroups: [] },
    ]
    const original = structuredClone(topology)

    expect(rotateFieldTopology(topology, 0)).toBe(topology)
    expect(rotateFieldTopology(topology, 4)).toBe(topology)
    expect(topology).toEqual(original)
  })

  it('вращает undefined для undefined', () => {
    expect(rotateFieldTopology(undefined, 1)).toBeUndefined()
  })
})
