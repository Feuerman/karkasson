import { describe, expect, it } from 'vitest'
import { findTileDefinitionById } from '@server/data/tileDefinitions'
import { TileId, type GameRules } from '@server/modules/types'

const noExpansions: GameRules = {
  finalScoringEnabled: true,
  expansions: {
    innsAndCathedrals: false,
    river: false,
    princessAndDragon: false,
  },
}

const allExpansions: GameRules = {
  finalScoringEnabled: true,
  expansions: {
    innsAndCathedrals: true,
    river: true,
    princessAndDragon: true,
  },
}

describe('findTileDefinitionById', () => {
  it('находит стандартный тайл без расширений', () => {
    const definition = findTileDefinitionById(TileId.A, noExpansions)
    expect(definition?.id).toBe(TileId.A)
  })

  it('возвращает undefined для тайла расширения при выключенном правиле', () => {
    expect(findTileDefinitionById(TileId.IAC_A, noExpansions)).toBeUndefined()
    expect(findTileDefinitionById(TileId.RIVER_A, noExpansions)).toBeUndefined()
    expect(findTileDefinitionById(TileId.PAD_A, noExpansions)).toBeUndefined()
  })

  it('находит тайлы расширений при включённых правилах', () => {
    expect(findTileDefinitionById(TileId.IAC_A, allExpansions)?.id).toBe(
      TileId.IAC_A
    )
    expect(findTileDefinitionById(TileId.RIVER_A, allExpansions)?.id).toBe(
      TileId.RIVER_A
    )
    expect(findTileDefinitionById(TileId.PAD_A, allExpansions)?.id).toBe(
      TileId.PAD_A
    )
  })

  it('возвращает undefined для неизвестного id', () => {
    const unknownId = 'NO-SUCH-TILE'
    expect(findTileDefinitionById(unknownId, allExpansions)).toBeUndefined()
  })
})
