import { describe, expect, it } from 'vitest'
import { calcCityScore, calcRoadScore } from '../../server/src/modules/scoring'
import type {
  BaseObject,
  GridTile,
  Scores,
  TilePlacesStats,
} from '../../server/src/modules/types'

/**
 * Детерминированные юнит-тесты подсчёта очков: в отличие от полной партии
 * здесь не работает случайность колоды — проверяются конкретные сценарии
 * (гербы, разделённые города, дублирующиеся подданные, объекты без фишек).
 */

function gridTile(overrides: Partial<GridTile> = {}): GridTile {
  return {
    id: 'T',
    rotation: 0,
    x: 0,
    y: 0,
    sides: { north: 'field', west: 'field', south: 'field', east: 'field' },
    ...overrides,
  } as GridTile
}

function boardOf(
  tiles: Array<[number, number, Partial<GridTile>?]>
): TilePlacesStats {
  const board: TilePlacesStats = {}
  for (const [y, x, overrides] of tiles) {
    if (!board[y]) board[y] = {}
    board[y][x] = gridTile({ x, y, ...(overrides ?? {}) })
  }
  return board
}

function scoresOf(): Scores {
  return {}
}

function follower(playerId: number, objectId: string) {
  return { playerId, objectId, point: { x: 0, y: 0 } }
}

describe('calcRoadScore', () => {
  it('дорога из 3 тайлов с одним подданным даёт 3 очка владельцу', () => {
    const board = boardOf([
      [0, 0],
      [0, 1],
      [0, 2],
    ])
    const road: BaseObject = {
      id: 'road-1',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      followers: [follower(1, 'road-1')],
    }

    const scores = scoresOf()
    const result = calcRoadScore(board, road, scores)

    expect(result.total).toBe(3)
    expect(result.players).toEqual({ 1: 3 })
    expect(result.objectId).toBe('road-1')
    expect(scores[1]).toBe(3)
  })

  it('несколько тайлов с общей стороной считаются один раз', () => {
    // Дорога изгибается: 4 точки на 2 тайлах (на каждом тайле дорога с 2 сторон)
    const board = boardOf([
      [0, 0],
      [0, 1],
    ])
    const road: BaseObject = {
      id: 'road-bend',
      points: [
        { x: 0, y: 0, direction: 'east' },
        { x: 1, y: 0, direction: 'west' },
      ],
      followers: [follower(2, 'road-bend')],
    }

    const scores = scoresOf()
    const result = calcRoadScore(board, road, scores)

    // Уникальных тайлов — 2, поэтому 2 очка, а не 4
    expect(result.total).toBe(2)
    expect(scores[2]).toBe(2)
  })

  it('два подданных одного игрока на дороге всё равно дают очки один раз', () => {
    const board = boardOf([[0, 0]])
    const road: BaseObject = {
      id: 'road-x2',
      points: [{ x: 0, y: 0 }],
      followers: [follower(1, 'road-x2'), follower(1, 'road-x2')],
    }

    const scores = scoresOf()
    const result = calcRoadScore(board, road, scores)

    // Очко за саму дорогу, а не за каждого подданного
    expect(result.total).toBe(1)
    expect(result.players).toEqual({ 1: 1 })
    expect(scores[1]).toBe(1)
  })

  it('подданные двух игроков делят дорогу: очки получают оба', () => {
    const board = boardOf([
      [0, 0],
      [0, 1],
    ])
    const road: BaseObject = {
      id: 'road-shared',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      followers: [follower(1, 'road-shared'), follower(2, 'road-shared')],
    }

    const scores = scoresOf()
    const result = calcRoadScore(board, road, scores)

    expect(result.total).toBe(4) // 2 + 2 (каждому по полному score)
    expect(result.players).toEqual({ 1: 2, 2: 2 })
    expect(scores[1]).toBe(2)
    expect(scores[2]).toBe(2)
  })

  it('дорога без подданных очки никому не начисляет', () => {
    const board = boardOf([[0, 0]])
    const road: BaseObject = {
      id: 'road-empty',
      points: [{ x: 0, y: 0 }],
      followers: [],
    }

    const scores = scoresOf()
    const result = calcRoadScore(board, road, scores)

    expect(result.total).toBe(1)
    expect(result.players).toEqual({})
    expect(result.objectId).toBeUndefined()
    expect(Object.keys(scores)).toHaveLength(0)
  })
})

describe('calcCityScore', () => {
  it('город из 1 тайла без герба даёт 2 очка', () => {
    const board = boardOf([[0, 0]])
    const city: BaseObject = {
      id: 'city-1',
      points: [{ x: 0, y: 0, pointType: 'city' }],
      followers: [follower(1, 'city-1')],
    }

    const scores = scoresOf()
    const result = calcCityScore(board, city, scores)

    expect(result.total).toBe(2)
    expect(scores[1]).toBe(2)
  })

  it('герб добавляет по 2 очка за каждый тайл с гербом', () => {
    const board = boardOf([
      [0, 0],
      [0, 1],
    ])
    board[0][1] = gridTile({ x: 1, y: 0, withShield: true })

    const city: BaseObject = {
      id: 'city-shield',
      points: [
        { x: 0, y: 0, pointType: 'city' },
        { x: 1, y: 0, pointType: 'city' },
      ],
      followers: [follower(1, 'city-shield')],
    }

    const scores = scoresOf()
    const result = calcCityScore(board, city, scores)

    // 2 тайла × 2 + герб × 2 = 6
    expect(result.total).toBe(6)
    expect(scores[1]).toBe(6)
  })

  it('город с гербом на 3 тайлах даёт 8 очков', () => {
    // Один герб из трёх тайлов
    const board = boardOf([
      [0, 0],
      [0, 1],
      [0, 2],
    ])
    board[0][1] = gridTile({ x: 1, y: 0, withShield: true })

    const city: BaseObject = {
      id: 'city-shield-2',
      points: [
        { x: 0, y: 0, pointType: 'city' },
        { x: 1, y: 0, pointType: 'city' },
        { x: 2, y: 0, pointType: 'city' },
      ],
      followers: [follower(1, 'city-shield-2')],
    }

    const scores = scoresOf()
    const result = calcCityScore(board, city, scores)

    expect(result.total).toBe(8) // 3×2 + 1×2
    expect(scores[1]).toBe(8)
  })

  it('город с равным числом подданных у двух игроков делят очки поровну', () => {
    const board = boardOf([[0, 0]])
    const city: BaseObject = {
      id: 'city-shared',
      points: [{ x: 0, y: 0, pointType: 'city' }],
      followers: [follower(1, 'city-shared'), follower(2, 'city-shared')],
    }

    const scores = scoresOf()
    const result = calcCityScore(board, city, scores)

    // 1 и 2 имеют по 1 фишке — оба лидеры, каждый получает полные очки
    expect(result.total).toBe(4) // 2 + 2
    expect(result.players).toEqual({ 1: 2, 2: 2 })
    expect(scores[1]).toBe(2)
    expect(scores[2]).toBe(2)
  })

  it('перевес по фишкам отдаёт очки только лидеру', () => {
    const board = boardOf([[0, 0]])
    const city: BaseObject = {
      id: 'city-leader',
      points: [{ x: 0, y: 0, pointType: 'city' }],
      followers: [
        follower(1, 'city-leader'),
        follower(1, 'city-leader'),
        follower(2, 'city-leader'),
      ],
    }

    const scores = scoresOf()
    const result = calcCityScore(board, city, scores)

    expect(result.total).toBe(2)
    expect(result.players).toEqual({ 1: 2 })
    expect(scores[1]).toBe(2)
    expect(scores[2]).toBeUndefined()
  })

  it('город без подданных очки не начисляет', () => {
    const board = boardOf([
      [0, 0],
      [0, 1],
    ])
    const city: BaseObject = {
      id: 'city-empty',
      points: [
        { x: 0, y: 0, pointType: 'city' },
        { x: 1, y: 0, pointType: 'city' },
      ],
      followers: [],
    }

    const scores = scoresOf()
    const result = calcCityScore(board, city, scores)

    expect(result.total).toBe(4)
    expect(result.players).toEqual({})
    expect(result.objectId).toBeUndefined()
    expect(Object.keys(scores)).toHaveLength(0)
  })
})
