/**
 * Каталог тайлов: единственный перечень источников тайлов и единственный
 * способ найти определение тайла по id.
 *
 * Раньше списки тайлов по дополнениям были перечислены в четырёх местах, а
 * определение искалось перебором массива — по нескольку раз на каждое
 * размещение тайла.
 */

import { ExpansionName, type GameRules } from '../modules/types'
import tiles, { type TileDefinition } from './tiles'
import { innsAndCathedralsTiles } from './innsAndCathedralsTiles'
import { riverTiles } from './riverTiles'
import { princessAndDragonTiles } from './princessAndDragonTiles'

/** Тайлы каждого дополнения. */
export const EXPANSION_TILE_SETS: Record<
  ExpansionName,
  readonly TileDefinition[]
> = {
  [ExpansionName.InnsAndCathedrals]: innsAndCathedralsTiles,
  [ExpansionName.River]: riverTiles,
  [ExpansionName.PrincessAndDragon]: princessAndDragonTiles,
}

/** Правило, включающее дополнение: по нему решается, доступен ли тайл. */
const EXPANSION_RULES: Record<ExpansionName, keyof GameRules['expansions']> = {
  [ExpansionName.InnsAndCathedrals]: 'innsAndCathedrals',
  [ExpansionName.River]: 'river',
  [ExpansionName.PrincessAndDragon]: 'princessAndDragon',
}

/**
 * Определения тайлов по id. Первый зарегистрированный выигрывает: так
 * сохраняется прежний приоритет — сначала базовая игра, потом дополнения.
 */
const TILE_DEFINITIONS_BY_ID = new Map<string, TileDefinition>()

for (const definition of [
  ...tiles,
  ...princessAndDragonTiles,
  ...innsAndCathedralsTiles,
  ...riverTiles,
]) {
  if (!TILE_DEFINITIONS_BY_ID.has(definition.id)) {
    TILE_DEFINITIONS_BY_ID.set(definition.id, definition)
  }
}

/** Тайл доступен в партии, если включено его дополнение. */
export function isExpansionAllowed(
  expansion: ExpansionName | undefined,
  rules: GameRules
): boolean {
  if (!expansion) return true
  return rules.expansions[EXPANSION_RULES[expansion]]
}

/** Тайл доступен в партии, если включено его дополнение. */
export function isTileAllowedByRules(
  definition: TileDefinition,
  rules: GameRules
): boolean {
  return isExpansionAllowed(definition.expansion, rules)
}

/** Ищет определение тайла по id с учётом включённых расширений. */
export function findTileDefinition(
  tileId: string,
  rules: GameRules
): TileDefinition | undefined {
  const definition = TILE_DEFINITIONS_BY_ID.get(tileId)
  if (!definition) return undefined
  return isTileAllowedByRules(definition, rules) ? definition : undefined
}

/** Все определения тайлов, доступные в партии с такими правилами. */
export function tilesForRules(rules: GameRules): TileDefinition[] {
  const enabledExpansions = Object.values(ExpansionName).filter(
    (expansion) => rules.expansions[EXPANSION_RULES[expansion]]
  )
  return [
    ...tiles,
    ...enabledExpansions.flatMap(
      (expansion) => EXPANSION_TILE_SETS[expansion] ?? []
    ),
  ]
}

/** Id всех тайлов, которые могут лежать в сохранении при таких правилах. */
export function allTileIds(rules: GameRules): Set<string> {
  return new Set(tilesForRules(rules).map((tile) => tile.id))
}
