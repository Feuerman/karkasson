/**
 * Топология дорожных и городских участков одного тайла.
 *
 * Каталог тайлов описывает группы соединённых сторон, но не всякий тайл
 * размечен полностью: стороны без группы считаются отдельными сегментами,
 * а перекрёстки без явных групп разбиваются по одной стороне. Нормализация
 * живёт здесь, чтобы и правила объектов, и подсчёт очков видели одинаковую
 * картину соединений.
 */

import type { TileDefinition } from '../data/tiles'
import { rotateTileGroups } from './tileRotation'
import { SIDE_NAMES, SideName, TileSideType, type Tile } from './types'

/** Признак, для которого ищутся группы сторон. */
export type TileFeature = typeof TileSideType.City | typeof TileSideType.Road

/**
 * Стороны, на которых соседние участки соединяются друг с другом.
 * Т-образные и четырёхсторонние перекрёстки делят ответвления независимо,
 * если каталог не задал для такого тайла собственных соединений (например,
 * у IAC-E) — тогда явные группы определяют топологию тайла.
 */
function useCatalogGroupsForCrossings(
  feature: TileFeature,
  featureSides: SideName[],
  groups: SideName[][]
): boolean {
  const connectedGroups = groups.filter((group) => group.length > 1)
  return !(
    feature === TileSideType.Road &&
    featureSides.length >= 3 &&
    connectedGroups.length < 2
  )
}

/**
 * Возвращает группы сторон тайла для дороги или города.
 *
 * @param tile тайл в текущем повороте; приоритет у групп самого тайла
 * @param definition каталоговое описание тайла, из которого берутся группы,
 *   если у тайла их нет (например, у только что выбранного игроком)
 */
export function resolveTileFeatureGroups(
  tile: Tile,
  definition: TileDefinition | undefined,
  feature: TileFeature
): SideName[][] {
  const featureSides = SIDE_NAMES.filter((side) => tile.sides[side] === feature)

  const tileGroups =
    feature === TileSideType.City ? tile.cityGroups : tile.roadGroups
  const definitionGroups =
    feature === TileSideType.City
      ? definition?.cityGroups
      : definition?.roadGroups
  const groups =
    tileGroups ??
    rotateTileGroups(definitionGroups, Math.round(tile.rotation / 90)) ??
    []

  if (!useCatalogGroupsForCrossings(feature, featureSides, groups)) {
    return featureSides.map((side) => [side])
  }

  // Нормализация не допускает дублирования стороны или включения в группу
  // стороны другого типа.
  const assigned = new Set<SideName>()
  const normalizedGroups = groups
    .map((group) =>
      group.filter((side) => {
        if (!featureSides.includes(side) || assigned.has(side)) {
          return false
        }
        assigned.add(side)
        return true
      })
    )
    .filter((group) => group.length > 0)

  for (const side of featureSides) {
    if (!assigned.has(side)) normalizedGroups.push([side])
  }

  return normalizedGroups
}
