import { describe, expect, it } from 'vitest'
import { buildFieldComponents } from '@server/modules/fieldComponents'
import type { GridTile } from '@server/modules/types'
import { SideName, TileSideType } from '@server/modules/types'
import { wholeTileField, fields, field } from '@server/data/fieldTopology'
import { formatGameData } from '@server/services/gameView'
import { GameManager } from '@server/modules/GameManager'
import { makePlayers } from '../helpers/fixtures'

function makeTile(
  rowIndex: number,
  tileIndex: number,
  topology: readonly {
    boundaryPorts: string[]
    adjacentCityGroups?: number[]
  }[]
): GridTile {
  return {
    id: 'test',
    rotation: 0,
    x: tileIndex,
    y: rowIndex,
    rowIndex,
    tileIndex,
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    },
    fieldTopology: topology.map((t) => ({
      boundaryPorts: t.boundaryPorts as never,
      adjacentCityGroups: t.adjacentCityGroups ?? [],
    })),
  } as unknown as GridTile
}

describe('Связные компоненты полей', () => {
  it('пустая доска не даёт компонентов', () => {
    expect(buildFieldComponents({})).toEqual([])
  })

  it('один тайл с полем на весь тайл — одна компонента', () => {
    const stats: Record<number, Record<number, GridTile>> = {
      0: { 0: makeTile(0, 0, wholeTileField()) },
    }
    const components = buildFieldComponents(stats)
    expect(components).toHaveLength(1)
    expect(components[0]?.regions).toHaveLength(1)
    expect(components[0]?.regions[0]).toEqual({
      rowIndex: 0,
      tileIndex: 0,
      regionIndex: 0,
    })
  })

  it('два соседних тайла с совпадающими полями — одна компонента', () => {
    const stats: Record<number, Record<number, GridTile>> = {
      0: {
        0: makeTile(0, 0, wholeTileField()),
        1: makeTile(0, 1, wholeTileField()),
      },
    }
    const components = buildFieldComponents(stats)
    expect(components).toHaveLength(1)
    expect(components[0]?.regions).toHaveLength(2)
  })

  it('два тайла с дорогой между сторонами — отдельные компоненты', () => {
    const stats: Record<number, Record<number, GridTile>> = {
      0: {
        0: makeTile(0, 0, fields(field(['eastNorth', 'eastSouth']))),
        1: makeTile(0, 1, fields(field(['westNorth', 'westSouth']))),
      },
    }
    const components = buildFieldComponents(stats)
    expect(components).toHaveLength(1)
    expect(components[0]?.regions).toHaveLength(2)
  })

  it('поле на одном тайле разбито дорогой — две компоненты', () => {
    const stats: Record<number, Record<number, GridTile>> = {
      0: {
        0: makeTile(
          0,
          0,
          fields(
            field(['northWest', 'northEast']),
            field(['southWest', 'southEast'])
          )
        ),
      },
    }
    const components = buildFieldComponents(stats)
    expect(components).toHaveLength(2)
    expect(components[0]?.regions).toHaveLength(1)
    expect(components[1]?.regions).toHaveLength(1)
  })

  it('L-образный тайл с тремя полями вокруг перекрёстка', () => {
    const stats: Record<number, Record<number, GridTile>> = {
      0: {
        0: makeTile(
          0,
          0,
          fields(
            field(['westNorth', 'eastNorth']),
            field(['eastSouth', 'southEast']),
            field(['southWest', 'westSouth'])
          )
        ),
      },
    }
    const components = buildFieldComponents(stats)
    expect(components).toHaveLength(3)
    expect(components.map((c) => c.regions.length)).toEqual([1, 1, 1])
  })

  it('компоненты имеют уникальные id', () => {
    const stats: Record<number, Record<number, GridTile>> = {
      0: {
        0: makeTile(0, 0, fields(field(['northWest']), field(['southWest']))),
      },
    }
    const components = buildFieldComponents(stats)
    const ids = components.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('сливает соседние поля в актуальном состоянии, возвращаемом клиенту', () => {
    const game = new GameManager({ players: makePlayers() })
    const leftTile = makeTile(0, 0, wholeTileField())
    const rightTile = makeTile(0, 1, wholeTileField())
    game.tilePlacesStats = { 0: { 0: leftTile } }

    expect(formatGameData(game).fieldComponents).toEqual([
      {
        id: 'field-0',
        regions: [{ rowIndex: 0, tileIndex: 0, regionIndex: 0 }],
      },
    ])

    const row = game.tilePlacesStats[0]
    if (!row) throw new Error('Expected the board row')
    row[1] = rightTile

    expect(formatGameData(game).fieldComponents).toEqual([
      {
        id: 'field-0',
        regions: [
          { rowIndex: 0, tileIndex: 0, regionIndex: 0 },
          { rowIndex: 0, tileIndex: 1, regionIndex: 0 },
        ],
      },
    ])
  })
})
