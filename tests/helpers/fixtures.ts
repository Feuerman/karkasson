import { SideName, TileId, TileSideType } from '@server/modules/types'
import type {
  GridTile,
  ObjectFollower,
  Player,
  Scores,
  TilePlacesStats,
} from '@server/modules/types'

/**
 * Общие заготовки юнит-тестов: пара игроков, пустая доска из полей,
 * подданный и пустой счёт. Тесты, которым нужны другие значения,
 * переопределяют их через параметры.
 */

/** Всегда свежая пара: тесты мутируют состояние игроков и запасы фишек */
export function makePlayers(): Player[] {
  return [1, 2].map((id) => ({
    id,
    name: id === 1 ? 'Alice' : 'Bob',
    color: id === 1 ? 'coral' : 'skyblue',
    score: 0,
    socketId: `socket-${id}`,
    deviceId: `device-${id}`,
  }))
}

/** Тайл-заглушка: четыре поля, координаты и герб задаются overrides */
export function gridTile(overrides: Partial<GridTile> = {}): GridTile {
  return {
    id: TileId.T,
    rotation: 0,
    x: 0,
    y: 0,
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    },
    ...overrides,
  } as GridTile
}

/** Доска из пар [rowIndex, tileIndex] с необязательными полями тайла */
export function boardOf(
  tiles: Array<[number, number, Partial<GridTile>?]>
): TilePlacesStats {
  const board: TilePlacesStats = {}
  for (const [y, x, overrides] of tiles) {
    if (!board[y]) board[y] = {}
    board[y][x] = gridTile({ x, y, ...(overrides ?? {}) })
  }
  return board
}

export function follower(
  playerId: number,
  objectId: string,
  point: { x: number; y: number } = { x: 0, y: 0 }
): ObjectFollower {
  return { playerId, objectId, point }
}

export function emptyScores(): Scores {
  return {}
}
