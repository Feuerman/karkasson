import { GameManager } from '@server/modules/GameManager'
import { SideName } from '@server/modules/types'
import type { AvailableFollowerPlace } from '@server/modules/GameManager'
import { makePlayers } from './fixtures'

/**
 * Заготовки для проверок размещения тайлов и фишек на живом GameManager.
 * Доска очищается от стартового тайла, чтобы каждый тест начинал с чистого
 * состояния и задавал соседей сам.
 */

export type GameManagerParams = NonNullable<
  ConstructorParameters<typeof GameManager>[0]
>

export const CENTER_X = 15
export const CENTER_Y = 15

/** GameManager без стартового тайла: доска и объекты задаются тестом */
export function makeEmptyGame(params: GameManagerParams = {}): GameManager {
  const game = new GameManager({
    players: makePlayers(),
    startImmediately: false,
    ...params,
  })
  emptyBoard(game)
  return game
}

/** Чистая доска без объектов и сетки стартового тайла */
export function emptyBoard(game: GameManager): void {
  game.temporaryObjects = {
    cities: [],
    roads: [],
    monasteries: [],
    gardens: [],
  }
  game.tilePlacesStats = {}
}

/** Назначает текущим игроком первого: нужно для placeTile и checkAvailableFollowers */
export function useFirstPlayerAsCurrent(game: GameManager): void {
  game.currentPlayer = game.players[0] ?? null
  game.currentPlayerIndex = 0
}

/** Направления доступных мест в отсортированном порядке — так сравнивают наборы */
export function directionsOf(
  places: readonly Pick<AvailableFollowerPlace, 'point'>[]
): string[] {
  return places
    .map(({ point }) => point.direction)
    .filter((direction) => direction !== undefined)
    .map((direction) => String(direction))
    .sort((left, right) => left.localeCompare(right))
}

/** Соседние клетки центра: координаты и стороны, прилегающие к тайлу */
export const NEIGHBOR_BY_SIDE = {
  [SideName.North]: {
    x: CENTER_X,
    y: CENTER_Y - 1,
    toward: SideName.South,
    away: SideName.North,
  },
  [SideName.East]: {
    x: CENTER_X + 1,
    y: CENTER_Y,
    toward: SideName.West,
    away: SideName.East,
  },
  [SideName.South]: {
    x: CENTER_X,
    y: CENTER_Y + 1,
    toward: SideName.North,
    away: SideName.South,
  },
  [SideName.West]: {
    x: CENTER_X - 1,
    y: CENTER_Y,
    toward: SideName.East,
    away: SideName.West,
  },
} as const

export type NeighborSide = keyof typeof NEIGHBOR_BY_SIDE
