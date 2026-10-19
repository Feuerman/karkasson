import type { TemporaryObjects, TilePlacesStats } from '@server/modules/types'
import type { IGameBoard } from '@/types/game'

/** Сколько объектов каждого вида стоит на доске. */
export interface GameObjectCounts {
  cities: number
  roads: number
  monasteries: number
  gardens: number
}

/** Партия в числах: сколько плиток ушло на доску и сколько объектов в игре. */
export interface GameProgress {
  /** Плитки, уже стоящие на доске. */
  placedTiles: number
  /** Плитки, оставшиеся в колоде. */
  remainingTiles: number
  /** Плитки партии: на доске, в колоде и на руках у игрока. */
  totalTiles: number
  /** Незавершённые объекты. */
  temporaryObjects: GameObjectCounts
  /** Завершённые объекты. */
  completedObjects: GameObjectCounts
  /** Все объекты на доске: незавершённые и завершённые. */
  objects: GameObjectCounts
}

/**
 * Считает плитки, стоящие на доске.
 *
 * Пустые клетки в снимке партии не хранятся, поэтому достаточно посчитать
 * занятые ячейки по строкам.
 */
export const countPlacedTiles = (
  tilePlacesStats?: TilePlacesStats | null
): number => {
  if (!tilePlacesStats) return 0

  return Object.values(tilePlacesStats).reduce(
    (count, row) => count + Object.values(row).filter(Boolean).length,
    0
  )
}

/** Сколько объектов каждого вида прислал сервер. */
export const countObjects = (
  objects?: TemporaryObjects | null
): GameObjectCounts => ({
  cities: objects?.cities?.length ?? 0,
  roads: objects?.roads?.length ?? 0,
  monasteries: objects?.monasteries?.length ?? 0,
  gardens: objects?.gardens?.length ?? 0,
})

/**
 * Собирает сведения о ходе партии для панели игрока.
 *
 * Все числа берутся из серверного снимка: клиент только показывает их.
 */
export const buildGameProgress = (
  gameBoard: Partial<IGameBoard>
): GameProgress => {
  const placedTiles = countPlacedTiles(gameBoard.tilePlacesStats)
  const remainingTiles = gameBoard.tilesList?.length ?? 0
  const heldTile = gameBoard.currentTile ? 1 : 0
  const temporaryObjects = countObjects(gameBoard.temporaryObjects)
  const completedObjects = countObjects(gameBoard.completedObjects)

  return {
    placedTiles,
    remainingTiles,
    totalTiles: placedTiles + remainingTiles + heldTile,
    temporaryObjects,
    completedObjects,
    objects: {
      cities: temporaryObjects.cities + completedObjects.cities,
      roads: temporaryObjects.roads + completedObjects.roads,
      monasteries: temporaryObjects.monasteries + completedObjects.monasteries,
      gardens: temporaryObjects.gardens + completedObjects.gardens,
    },
  }
}

/** Доля выложенных плиток в процентах: сколько партии уже позади. */
export const progressPercent = (progress: GameProgress): number => {
  if (progress.totalTiles <= 0) return 0

  return Math.round((progress.placedTiles / progress.totalTiles) * 100)
}
