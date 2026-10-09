import tiles from './tiles'
import { innsAndCathedralsTiles } from './innsAndCathedralsTiles'
import { riverTiles } from './riverTiles'
import { princessAndDragonTiles } from './princessAndDragonTiles'
import type { TileDefinition } from './tiles'
import type { GameRules } from '../modules/types'

/** Ищет определение тайла по id с учётом включённых расширений. */
export function findTileDefinitionById(
  tileId: string,
  rules: GameRules
): TileDefinition | undefined {
  const standardTile = tiles.find((tile) => tile.id === tileId)
  if (standardTile) return standardTile
  if (rules.expansions.princessAndDragon) {
    const princessAndDragonTile = princessAndDragonTiles.find(
      (tile) => tile.id === tileId
    )
    if (princessAndDragonTile) return princessAndDragonTile
  }
  return (
    (rules.expansions.innsAndCathedrals
      ? innsAndCathedralsTiles.find((tile) => tile.id === tileId)
      : undefined) ??
    (rules.expansions.river
      ? riverTiles.find((tile) => tile.id === tileId)
      : undefined)
  )
}
