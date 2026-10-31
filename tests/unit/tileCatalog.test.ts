import { describe, expect, it } from 'vitest'
import {
  allTileIds,
  findTileDefinition,
  isExpansionAllowed,
  tilesForRules,
} from '@server/data/tileCatalog'
import { FIELD_BOUNDARY_PORTS } from '@server/data/fieldTopology'
import { validateTileTopologies } from '@server/data/fieldTopologyValidation'
import { tiles as baseTiles } from '@server/data/tiles'
import { innsAndCathedralsTiles } from '@server/data/innsAndCathedralsTiles'
import { riverTiles } from '@server/data/riverTiles'
import { princessAndDragonTiles } from '@server/data/princessAndDragonTiles'
import {
  DEFAULT_GAME_RULES,
  ExpansionName,
  TileId,
  type GameRules,
} from '@server/modules/types'

const noExpansions: GameRules = DEFAULT_GAME_RULES

const allExpansions: GameRules = {
  expansions: {
    innsAndCathedrals: true,
    river: true,
    princessAndDragon: true,
  },
}

describe('findTileDefinition', () => {
  it('находит стандартный тайл без расширений', () => {
    const definition = findTileDefinition(TileId.A, noExpansions)
    expect(definition?.id).toBe(TileId.A)
  })

  it.each([TileId.IAC_A, TileId.RIVER_A, TileId.PAD_A])(
    'не находит тайл расширения %s при выключенных правилах',
    (tileId) => {
      expect(findTileDefinition(tileId, noExpansions)).toBeUndefined()
    }
  )

  it.each([TileId.IAC_A, TileId.RIVER_A, TileId.PAD_A])(
    'находит тайл расширения %s при включённых правилах',
    (tileId) => {
      expect(findTileDefinition(tileId, allExpansions)?.id).toBe(tileId)
    }
  )

  it('возвращает undefined для неизвестного id', () => {
    const unknownId = 'NO-SUCH-TILE'
    expect(findTileDefinition(unknownId, allExpansions)).toBeUndefined()
  })
})

describe('isExpansionAllowed', () => {
  it('тайл без расширения доступен всегда', () => {
    expect(isExpansionAllowed(undefined, noExpansions)).toBe(true)
  })

  it.each([
    [ExpansionName.InnsAndCathedrals, 'innsAndCathedrals'],
    [ExpansionName.River, 'river'],
    [ExpansionName.PrincessAndDragon, 'princessAndDragon'],
  ] as const)(
    'тайл расширения %s доступен только при включённом правиле',
    (expansion, rule) => {
      expect(isExpansionAllowed(expansion, noExpansions)).toBe(false)
      expect(
        isExpansionAllowed(expansion, {
          ...noExpansions,
          expansions: { ...noExpansions.expansions, [rule]: true },
        })
      ).toBe(true)
    }
  )
})

describe('tilesForRules', () => {
  it('без расширений содержит только базовые тайлы', () => {
    const ids = tilesForRules(noExpansions).map((tile) => tile.id)
    expect(ids).toContain(TileId.A)
    expect(ids).not.toContain(TileId.IAC_A)
    expect(ids).not.toContain(TileId.RIVER_A)
    expect(ids).not.toContain(TileId.PAD_A)
  })

  it('с включёнными расширениями содержит тайлы каждого расширения', () => {
    const ids = tilesForRules(allExpansions).map((tile) => tile.id)
    expect(ids).toContain(TileId.A)
    expect(ids).toContain(TileId.IAC_A)
    expect(ids).toContain(TileId.RIVER_A)
    expect(ids).toContain(TileId.PAD_A)
  })
})

describe('allTileIds', () => {
  it('без расширений содержит только базовые тайлы', () => {
    const ids = allTileIds(noExpansions)
    expect(ids.has(TileId.A)).toBe(true)
    expect(ids.has(TileId.IAC_A)).toBe(false)
    expect(ids.has(TileId.RIVER_A)).toBe(false)
    expect(ids.has(TileId.PAD_A)).toBe(false)
  })

  it('с включёнными расширениями содержит тайлы каждого расширения', () => {
    const ids = allTileIds(allExpansions)
    expect(ids.has(TileId.A)).toBe(true)
    expect(ids.has(TileId.IAC_A)).toBe(true)
    expect(ids.has(TileId.RIVER_A)).toBe(true)
    expect(ids.has(TileId.PAD_A)).toBe(true)
  })
})

describe('field topology on tile definitions', () => {
  const allDefinitions = [
    ...baseTiles,
    ...innsAndCathedralsTiles,
    ...riverTiles,
    ...princessAndDragonTiles,
  ]

  it('топология каждого тайла валидна и не дублирует граничные сегменты', () => {
    expect(validateTileTopologies(allDefinitions)).toEqual([])
  })

  it('у тайла L три поля вокруг перекрёстка, нижнее разделено дорогой', () => {
    const topology = allDefinitions.find(
      ({ id }) => id === TileId.L
    )?.fieldTopology
    expect(topology).toBeDefined()
    expect(topology).toHaveLength(3)
    expect(topology?.map(({ boundaryPorts }) => boundaryPorts)).toEqual([
      ['westNorth', 'eastNorth'],
      ['eastSouth', 'southEast'],
      ['southWest', 'westSouth'],
    ])
    expect(topology?.[0]?.adjacentCityGroups).toEqual([0])
  })

  it('назначает все восемь half-edge портов перекрёстку X по одному разу', () => {
    const topology = allDefinitions.find(
      ({ id }) => id === TileId.X
    )?.fieldTopology
    expect(topology).toBeDefined()
    const ports = topology?.flatMap(({ boundaryPorts }) => boundaryPorts)
    expect(topology).toHaveLength(4)
    expect(ports).toHaveLength(FIELD_BOUNDARY_PORTS.length)
    expect(new Set(ports).size).toBe(FIELD_BOUNDARY_PORTS.length)
  })

  it('проверяет, что port matching на противоположных краях взаимно обратен', () => {
    const opposites = {
      northWest: 'southWest',
      northEast: 'southEast',
      eastNorth: 'westNorth',
      eastSouth: 'westSouth',
      southEast: 'northEast',
      southWest: 'northWest',
      westSouth: 'eastSouth',
      westNorth: 'eastNorth',
    } as const

    for (const port of FIELD_BOUNDARY_PORTS) {
      expect(opposites[opposites[port]]).toBe(port)
    }
  })

  it('у T-образного перекрёстка северная зона соединяет верхние углы', () => {
    const topology = allDefinitions.find(
      ({ id }) => id === TileId.W
    )?.fieldTopology
    expect(topology).toBeDefined()
    expect(topology).toHaveLength(3)
    expect(topology?.[0]?.boundaryPorts).toContain('northWest')
    expect(topology?.[0]?.boundaryPorts).toContain('northEast')
  })

  it('дополнения с отдельными городами ссылаются на свои группы отдельно', () => {
    const topology = allDefinitions.find(
      ({ id }) => id === TileId.PAD_Y
    )?.fieldTopology
    expect(topology).toBeDefined()
    expect(
      topology?.map(({ adjacentCityGroups }) => adjacentCityGroups)
    ).toEqual([[0, 1]])
  })
})
