import { GameManager } from '@server/modules/GameManager'
import { SideName } from '@server/modules/types'
import type { AvailableFollowerPlace } from '@server/modules/GameManager'
import type {
  BaseObject,
  GridTile,
  Player,
  PointDirection,
  Tile,
} from '@server/modules/types'
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

/** Назначает текущим игроком: нужно для placeTile и checkAvailableFollowers */
export function usePlayerAsCurrent(
  game: {
    players: Player[]
    currentPlayer: Player | null
    currentPlayerIndex: number
  },
  index: number
): void {
  game.currentPlayer = game.players[index] ?? null
  game.currentPlayerIndex = index
}

/** Тайл, который кладётся в центр доски: координаты проставляет хелпер */
type CenterTile = Pick<GridTile, 'id' | 'sides'> &
  Partial<Omit<GridTile, 'x' | 'y'>>

/** Кладёт тайл в центр доски, не пересобирая объекты */
export function setCenterTile(game: GameManager, tile: CenterTile): GridTile {
  const gridTile: GridTile = { rotation: 0, ...tile, x: CENTER_X, y: CENTER_Y }
  game.tilePlacesStats[CENTER_Y] = { [CENTER_X]: gridTile }
  return gridTile
}

/**
 * Кладёт тайл в центр доски и пересобирает объекты по всей доске: так тайл
 * оказывается на месте так же, как после настоящего размещения.
 */
export function placeCenterTile(game: GameManager, tile: CenterTile): GridTile {
  const gridTile = setCenterTile(game, tile)
  game.checkGridAfterPlacingTile(CENTER_Y, CENTER_X)
  return gridTile
}

/**
 * Кладёт тайл на доску настоящим placeTile: currentTile и координаты
 * проставляет хелпер, тест отвечает только за стороны тайла и за клетку.
 */
export function placeTileOnBoard(
  game: GameManager,
  tile: Omit<Tile, 'x' | 'y'> & Partial<Pick<GridTile, 'x' | 'y'>>,
  row: number,
  col: number
): boolean {
  game.currentTile = { ...tile, x: col, y: row }
  return game.placeTile(game.currentTile, row, col)
}

/** Объект, в котором есть точка в указанном направлении */
export function objectAt<T extends BaseObject>(
  objects: T[],
  direction: PointDirection
): T | undefined {
  return objects.find((object) =>
    object.points.some((point) => point.direction === direction)
  )
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

/** Все четыре поворота тайла в порядке от исходного до 270 градусов. */
export function rotatedCopies(
  game: Pick<GameManager, 'rotateTile'>,
  tile: Omit<Tile, 'rotation'> & { rotation?: number }
): Tile[] {
  const copies: Tile[] = []
  let rotated: Tile = { ...tile, rotation: 0 }

  for (let turn = 0; turn < 4; turn += 1) {
    copies.push(rotated)
    rotated = game.rotateTile(rotated)
  }

  return copies
}
