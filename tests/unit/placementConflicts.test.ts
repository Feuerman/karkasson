import { describe, expect, it } from 'vitest'
import {
  findTileSideConflicts,
  isCorrectTilePosition,
} from '@server/modules/gameGeometry'
import {
  describePlacementConflicts,
  describePlacementFailure,
  describeRiverConflict,
  PLACEMENT_FAILURE_MESSAGE,
} from '@server/socket/handlers/placementErrors'
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

function sidesWith(side: SideName, sideType: TileSideType): TileSides {
  return {
    [SideName.North]: side === SideName.North ? sideType : TileSideType.Field,
    [SideName.East]: side === SideName.East ? sideType : TileSideType.Field,
    [SideName.South]: side === SideName.South ? sideType : TileSideType.Field,
    [SideName.West]: side === SideName.West ? sideType : TileSideType.Field,
  }
}

function allSides(sideType: TileSideType): TileSides {
  return {
    [SideName.North]: sideType,
    [SideName.East]: sideType,
    [SideName.South]: sideType,
    [SideName.West]: sideType,
  }
}

function conflict(
  side: SideName,
  rowIndex: number,
  tileIndex: number,
  own: TileSideType,
  adjacent: TileSideType
) {
  return { side, rowIndex, tileIndex, own, adjacent }
}

const northConflict = conflict(
  SideName.North,
  14,
  15,
  TileSideType.Field,
  TileSideType.City
)
const eastConflict = conflict(
  SideName.East,
  15,
  16,
  TileSideType.Road,
  TileSideType.Field
)

describe('Конфликты сторон при размещении тайла', () => {
  const target = { rowIndex: 15, tileIndex: 15 }

  it('возвращает несовпавшую сторону и координаты соседа', () => {
    const neighbour = makeNeighbour({
      sides: sidesWith(SideName.South, TileSideType.City),
    })
    const tile = makeTile(sidesWith(SideName.North, TileSideType.Field))
    const stats = makeStats(neighbour)

    expect(
      findTileSideConflicts(
        tile,
        target.rowIndex,
        target.tileIndex,
        stats,
        false
      )
    ).toEqual([northConflict])
    expect(
      isCorrectTilePosition(
        tile,
        target.rowIndex,
        target.tileIndex,
        stats,
        false
      )
    ).toBe(false)
  })

  it('не сообщает конфликтов, когда стороны совпадают', () => {
    const neighbour = makeNeighbour({
      sides: sidesWith(SideName.South, TileSideType.Road),
    })
    const tile = makeTile(sidesWith(SideName.North, TileSideType.Road))
    const stats = makeStats(neighbour)

    expect(
      findTileSideConflicts(
        tile,
        target.rowIndex,
        target.tileIndex,
        stats,
        false
      )
    ).toEqual([])
    expect(
      isCorrectTilePosition(
        tile,
        target.rowIndex,
        target.tileIndex,
        stats,
        false
      )
    ).toBe(true)
  })

  it('возвращает пустой список без соседей, на занятой клетке и на пустой доске', () => {
    const tile = makeTile(allSides(TileSideType.City))
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
    const message = describePlacementConflicts([northConflict, eastConflict])

    expect(message).toBe(
      `${PLACEMENT_FAILURE_MESSAGE}: на северной стороне у вас — поле, ` +
        'а у соседнего тайла на юге — город; ' +
        'на восточной стороне у вас — дорога, а у соседнего тайла на западе — поле.'
    )
  })
})

describe('Описание причины отказа по реке', () => {
  it('без конфликтов возвращает общее сообщение', () => {
    expect(describePlacementFailure([])).toBe(PLACEMENT_FAILURE_MESSAGE)
  })

  it('для несовпавшей стороны повторяет сообщение о размещении', () => {
    const conflicts = [northConflict]

    const message = describePlacementFailure(conflicts)

    expect(message).toBe(
      `${PLACEMENT_FAILURE_MESSAGE}: на северной стороне у вас — поле, ` +
        'а у соседнего тайла на юге — город.'
    )
  })

  it('отдаёт приоритет причине по реке перед конфликтами сторон', () => {
    const sideConflict = northConflict
    const riverConflict = {
      reason: 'openEnd' as const,
      side: SideName.South,
      rowIndex: 15,
      tileIndex: 15,
    }

    expect(describePlacementFailure([sideConflict, riverConflict])).toBe(
      describeRiverConflict(riverConflict)
    )
    expect(describePlacementFailure([riverConflict, sideConflict])).toBe(
      describeRiverConflict(riverConflict)
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
    expect(message).toBe(
      `${PLACEMENT_FAILURE_MESSAGE}: река — у соседнего тайла остался незакрытый конец русла.`
    )
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

    expect(message).toBe(
      `${PLACEMENT_FAILURE_MESSAGE}: река — русло этого тайла выходит не в ту сторону.`
    )
  })
})
