import { describe, expect, it } from 'vitest'
import {
  describePlacementConflicts,
  describePlacementFailure,
  findTileSideConflicts,
  isCorrectTilePosition,
  PLACEMENT_FAILURE_MESSAGE,
} from '@server/modules/gameGeometry'
import {
  SideName,
  TileSideType,
  type GridTile,
  type Tile,
  type TilePlacesStats,
  type TileSides,
} from '@server/modules/types'

function makeTile(sides: TileSides): Tile {
  return { id: 'placement-conflict-tile', rotation: 0, sides }
}

function makeNeighbour(overrides: Partial<GridTile> = {}): GridTile {
  return {
    id: 'neighbour-tile',
    rotation: 0,
    x: 15,
    y: 14,
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    },
    ...overrides,
  }
}

function makeStats(neighbour: GridTile): TilePlacesStats {
  return { [neighbour.y]: { [neighbour.x]: neighbour } }
}

describe('Конфликты сторон при размещении тайла', () => {
  const target = { rowIndex: 15, tileIndex: 15 }

  it('возвращает несовпавшую сторону и координаты соседа', () => {
    const neighbour = makeNeighbour({
      sides: {
        [SideName.North]: TileSideType.Field,
        [SideName.East]: TileSideType.Field,
        [SideName.South]: TileSideType.City,
        [SideName.West]: TileSideType.Field,
      },
    })
    const tile = makeTile({
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    })

    expect(
      findTileSideConflicts(
        tile,
        target.rowIndex,
        target.tileIndex,
        makeStats(neighbour),
        false
      )
    ).toEqual([
      {
        side: SideName.North,
        rowIndex: 14,
        tileIndex: 15,
        own: TileSideType.Field,
        adjacent: TileSideType.City,
      },
    ])
    expect(
      isCorrectTilePosition(
        tile,
        target.rowIndex,
        target.tileIndex,
        makeStats(neighbour),
        false
      )
    ).toBe(false)
  })

  it('не сообщает конфликтов, когда стороны совпадают', () => {
    const neighbour = makeNeighbour({
      sides: {
        [SideName.North]: TileSideType.Field,
        [SideName.East]: TileSideType.Field,
        [SideName.South]: TileSideType.Road,
        [SideName.West]: TileSideType.Field,
      },
    })
    const tile = makeTile({
      [SideName.North]: TileSideType.Road,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    })

    expect(
      findTileSideConflicts(
        tile,
        target.rowIndex,
        target.tileIndex,
        makeStats(neighbour),
        false
      )
    ).toEqual([])
    expect(
      isCorrectTilePosition(
        tile,
        target.rowIndex,
        target.tileIndex,
        makeStats(neighbour),
        false
      )
    ).toBe(true)
  })

  it('возвращает пустой список без соседей, на занятой клетке и на пустой доске', () => {
    const tile = makeTile({
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.City,
      [SideName.West]: TileSideType.City,
    })
    const neighbour = makeNeighbour()
    const stats = makeStats(neighbour)

    expect(
      findTileSideConflicts(tile, target.rowIndex, target.tileIndex, {}, false)
    ).toEqual([])
    expect(
      findTileSideConflicts(tile, neighbour.y, neighbour.x, stats, false)
    ).toEqual([])
    expect(
      findTileSideConflicts(
        tile,
        target.rowIndex,
        target.tileIndex,
        stats,
        true
      )
    ).toEqual([])
  })
})

describe('Описание причины отказа в размещении', () => {
  it('без конфликтов возвращает общее сообщение', () => {
    expect(describePlacementConflicts([])).toBe(PLACEMENT_FAILURE_MESSAGE)
  })

  it('перечисляет каждую несовпавшую сторону с типами', () => {
    const message = describePlacementConflicts([
      {
        side: SideName.North,
        rowIndex: 14,
        tileIndex: 15,
        own: TileSideType.Field,
        adjacent: TileSideType.City,
      },
      {
        side: SideName.East,
        rowIndex: 15,
        tileIndex: 16,
        own: TileSideType.Road,
        adjacent: TileSideType.Field,
      },
    ])

    expect(message.startsWith(PLACEMENT_FAILURE_MESSAGE)).toBe(true)
    expect(message).toContain('север — поле, а у соседа с юга — город')
    expect(message).toContain('восток — дорога, а у соседа с запада — поле')
    expect(message.endsWith('.')).toBe(true)
  })
})

describe('Описание причины отказа по реке', () => {
  it('возвращает общее сообщение без конфликтов и сообщение сторон для сторон', () => {
    expect(describePlacementFailure([])).toBe(PLACEMENT_FAILURE_MESSAGE)
    expect(
      describePlacementFailure([
        {
          side: SideName.North,
          rowIndex: 14,
          tileIndex: 15,
          own: TileSideType.Field,
          adjacent: TileSideType.City,
        },
      ])
    ).toBe(
      describePlacementConflicts([
        {
          side: SideName.North,
          rowIndex: 14,
          tileIndex: 15,
          own: TileSideType.Field,
          adjacent: TileSideType.City,
        },
      ])
    )
  })

  it('описывает незакрытый конец русла с указанием соседа', () => {
    const message = describePlacementFailure([
      {
        reason: 'openEnd',
        side: SideName.South,
        rowIndex: 15,
        tileIndex: 15,
      },
    ])

    expect(message.startsWith(PLACEMENT_FAILURE_MESSAGE)).toBe(true)
    expect(message).toContain('река')
    expect(message).toContain('незакрытый конец')
    expect(message.endsWith('.')).toBe(true)
  })

  it('описывает выход русла не в ту сторону', () => {
    const message = describePlacementFailure([
      {
        reason: 'wrongSide',
        side: SideName.South,
        rowIndex: 15,
        tileIndex: 15,
      },
    ])

    expect(message.startsWith(PLACEMENT_FAILURE_MESSAGE)).toBe(true)
    expect(message).toContain('река')
    expect(message).toContain('не в ту сторону')
    expect(message.endsWith('.')).toBe(true)
  })
})
