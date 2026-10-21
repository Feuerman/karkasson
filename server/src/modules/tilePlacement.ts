/**
 * Разрешение тайла для постановки.
 *
 * Это чистая функция от правил партии и каталога тайлов: она ничего не знает
 * о доске и может проверяться без неё. Серверный источник истины для
 * присланного клиентом тайла: стороны и группы берутся из каталога, а из
 * клиентского объекта допускается только поворот (и флаг сада для тестовых
 * тайлов).
 */

import { findTileDefinition, isExpansionAllowed } from '../data/tileCatalog'
import { applyQuarterTurns } from './tileRotation'
import type { GameRules, Tile } from './types'

/** Что нужно знать о партии, чтобы решить, можно ли поставить тайл. */
export interface TilePlacementContext {
  rules: GameRules
  /** Партия закончена: тайлы не ставятся. */
  gameIsEnded: boolean
  /** Ставится стартовый тайл: правила реки на него не распространяются. */
  isPlacingStartTile: boolean
  /** На доске есть тайл, закрывающий русло. */
  hasRiverEnd: boolean
}

/**
 * Разрешает присланный тайл: возвращает authoritative-тайл или `undefined`,
 * если его нельзя играть при действующих расширениях.
 */
export function resolvePlacementTile(
  tile: Tile,
  context: TilePlacementContext,
  options: { simulation?: boolean } = {}
): Tile | undefined {
  if (context.gameIsEnded) return undefined

  const tileDefinition = findTileDefinition(tile.id, context.rules)
  if (options.simulation && !tileDefinition && !tile.id.startsWith('test')) {
    return undefined
  }

  const authoritativeTile: Tile = tileDefinition
    ? { ...tileDefinition, rotation: 0 }
    : { ...tile }

  if (!isExpansionTileAllowed(authoritativeTile, context.rules))
    return undefined
  if (isRiverTileRequiredAndMissing(authoritativeTile, context))
    return undefined

  return applyRequestedRotation(
    tile,
    authoritativeTile,
    Boolean(tileDefinition)
  )
}

/** Расширение тайла должно быть включено в правила партии. */
export function isExpansionTileAllowed(tile: Tile, rules: GameRules): boolean {
  return isExpansionAllowed(tile.expansion, rules)
}

/**
 * В партии с River, пока русло не закрыто, ход обязан продолжать реку.
 * Стартовый тайл правило не распространяется: русло начинается на нём.
 */
export function isRiverTileRequiredAndMissing(
  tile: Tile,
  context: TilePlacementContext
): boolean {
  if (!context.rules.expansions.river) return false
  if (context.isPlacingStartTile) return false
  return !tile.riverGroups?.length && !context.hasRiverEnd
}

/**
 * Поворачивает каталожный тайл на запрошенный угол. Для тайла из колоды
 * поворот применяется к определению, а для тестовых тайлов (`test*`), у
 * которых определения нет, стороны остаются как есть.
 */
export function applyRequestedRotation(
  tile: Tile,
  authoritativeTile: Tile,
  hasDefinition: boolean
): Tile {
  if (!hasDefinition) {
    // Тестовый тайл приходит целиком с клиента: каталога для него нет.
    return {
      ...authoritativeTile,
      hasGarden: tile.hasGarden ?? authoritativeTile.hasGarden,
    }
  }

  // Угол из клиента не доверяем: округляем до четверти оборота.
  const turnCount = 360 / 90
  const turns =
    ((Math.round(tile.rotation / 90) % turnCount) + turnCount) % turnCount

  return {
    ...applyQuarterTurns(authoritativeTile, turns),
    hasGarden: tile.hasGarden ?? authoritativeTile.hasGarden,
    // Угол сохраняется для истории и отображения: он уже нормализован.
    rotation: turns * 90,
  }
}
