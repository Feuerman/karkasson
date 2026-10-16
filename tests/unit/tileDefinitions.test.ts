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

  it.each([TileId.IAC_A, TileId.RIVER_A, TileId.PAD_A])(
    'не находит тайл расширения %s при выключенных правилах',
    (tileId) => {
      expect(findTileDefinitionById(tileId, noExpansions)).toBeUndefined()
    }
  )

  it.each([TileId.IAC_A, TileId.RIVER_A, TileId.PAD_A])(
    'находит тайл расширения %s при включённых правилах',
    (tileId) => {
      expect(findTileDefinitionById(tileId, allExpansions)?.id).toBe(tileId)
    }
  )

  it('возвращает undefined для неизвестного id', () => {
    const unknownId = 'NO-SUCH-TILE'
    expect(findTileDefinitionById(unknownId, allExpansions)).toBeUndefined()
  })
})
