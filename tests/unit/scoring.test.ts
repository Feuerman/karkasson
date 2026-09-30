import { describe, expect, it } from 'vitest'
import { innsAndCathedralsTiles } from '../../server/src/data/innsAndCathedralsTiles'
import {
  calcCityScore,
  calcGardenPoints,
  calcMonasteryPoints,
  calcRoadScore,
} from '../../server/src/modules/scoring'
import { SideName, TileId, TileSideType } from '../../server/src/modules/types'
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
    id: TileId.T,
    rotation: 0,
    x: 0,
    y: 0,
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
    },
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
  it('удваивает очки завершённой дороги с таверной только в дополнении', () => {
    const board = boardOf([
      [0, 0],
      [0, 1],
    ])
    const road: BaseObject = {
      id: 'inn-road',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      followers: [follower(1, 'inn-road')],
      hasInn: true,
    }
    const scores = scoresOf()

    expect(calcRoadScore(board, road, scores, true, false).total).toBe(2)
    expect(calcRoadScore(board, road, scores, true, true).total).toBe(4)
  })

  it('незавершённая дорога с таверной не приносит финальных очков', () => {
    const road: BaseObject = {
      id: 'unfinished-inn-road',
      points: [{ x: 0, y: 0 }],
      followers: [follower(1, 'unfinished-inn-road')],
      hasInn: true,
    }
    const scores = scoresOf()

    expect(
      calcRoadScore(boardOf([[0, 0]]), road, scores, false, true).total
    ).toBe(0)
    expect(scores[1]).toBe(0)
  })

  it('большой подданный считается за два только для включённого дополнения', () => {
    const road: BaseObject = {
      id: 'majority-road',
      points: [{ x: 0, y: 0 }],
      followers: [
        { ...follower(1, 'majority-road'), isBigFollower: true },
        follower(2, 'majority-road'),
      ],
    }

    expect(
      calcRoadScore(boardOf([[0, 0]]), road, {}, true, false, false).players
    ).toEqual({ 1: 1, 2: 1 })
    expect(
      calcRoadScore(boardOf([[0, 0]]), road, {}, true, true, true).players
    ).toEqual({ 1: 1 })
  })

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
        { x: 0, y: 0, direction: SideName.East },
        { x: 1, y: 0, direction: SideName.West },
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
  it('считает герб только в соответствующей группе города на IAC-P', () => {
    const tileDefinition = innsAndCathedralsTiles.find(
      ({ id }) => id === TileId.IAC_P
    )
    if (!tileDefinition) throw new Error('Tile IAC-P is missing')
    const board = boardOf([
      [0, 0, { ...tileDefinition, rotation: 0, x: 0, y: 0 }],
    ])
    const shieldedCity: BaseObject = {
      id: 'shielded-city',
      points: [{ x: 0, y: 0, direction: SideName.North }],
      followers: [follower(1, 'shielded-city')],
    }
    const otherCity: BaseObject = {
      id: 'other-city',
      points: [{ x: 0, y: 0, direction: SideName.South }],
      followers: [follower(2, 'other-city')],
    }

    expect(calcCityScore(board, shieldedCity, {}).total).toBe(4)
    expect(calcCityScore(board, otherCity, {}).total).toBe(2)
  })

  it('начисляет по 3 очка за тайл и герб завершённого города с собором', () => {
    const city: BaseObject = {
      id: 'cathedral-city',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      followers: [follower(1, 'cathedral-city')],
      hasCathedral: true,
    }
    const board = boardOf([
      [0, 0],
      [0, 1, { withShield: true }],
    ])

    expect(calcCityScore(board, city, {}, true, false).total).toBe(6)
    expect(calcCityScore(board, city, {}, true, true).total).toBe(9)
  })

  it('делит очки большого города с собором между тремя равными лидерами', () => {
    const tileCount = 18
    const shieldCount = 4
    const tiles: Array<[number, number, Partial<GridTile>?]> = []
    for (let x = 0; x < tileCount; x++) {
      tiles.push([0, x, x < shieldCount ? { withShield: true } : undefined])
    }
    const board = boardOf(tiles)
    const city: BaseObject = {
      id: 'large-cathedral-city',
      points: Array.from({ length: tileCount }, (_, x) => ({ x, y: 0 })),
      followers: [
        follower(1, 'large-cathedral-city'),
        follower(2, 'large-cathedral-city'),
        follower(3, 'large-cathedral-city'),
      ],
      hasCathedral: true,
    }
    const scores = scoresOf()

    const result = calcCityScore(board, city, scores, true, true)

    expect(result.players).toEqual({ 1: 66, 2: 66, 3: 66 })
    expect(result.total).toBe(198)
    expect(scores).toEqual({ 1: 66, 2: 66, 3: 66 })
  })

  it('незавершённый город с собором не приносит финальных очков', () => {
    const city: BaseObject = {
      id: 'unfinished-cathedral',
      points: [{ x: 0, y: 0 }],
      followers: [follower(1, 'unfinished-cathedral')],
      hasCathedral: true,
    }

    expect(calcCityScore(boardOf([[0, 0]]), city, {}, false, true).total).toBe(
      0
    )
  })

  it('город из 1 тайла без герба даёт 2 очка', () => {
    const board = boardOf([[0, 0]])
    const city: BaseObject = {
      id: 'city-1',
      points: [{ x: 0, y: 0, pointType: TileSideType.City }],
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
        { x: 0, y: 0, pointType: TileSideType.City },
        { x: 1, y: 0, pointType: TileSideType.City },
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
        { x: 0, y: 0, pointType: TileSideType.City },
        { x: 1, y: 0, pointType: TileSideType.City },
        { x: 2, y: 0, pointType: TileSideType.City },
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
      points: [{ x: 0, y: 0, pointType: TileSideType.City }],
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
      points: [{ x: 0, y: 0, pointType: TileSideType.City }],
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
        { x: 0, y: 0, pointType: TileSideType.City },
        { x: 1, y: 0, pointType: TileSideType.City },
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

describe('calcMonasteryPoints', () => {
  it('изолированный монастырь даёт 1 очко (только сам тайл)', () => {
    const board = boardOf([[0, 0]])
    const monastery: BaseObject = {
      id: 'monastery-1',
      points: [{ x: 0, y: 0, pointType: TileSideType.City }],
      isMonastery: true,
      followers: [],
    }

    const points = calcMonasteryPoints(board, monastery)

    expect(points).toBe(1)
  })

  it('монастырь в окружении 3×3 даёт 9 очков', () => {
    const board = boardOf([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ])
    const monastery: BaseObject = {
      id: 'monastery-full',
      points: [{ x: 1, y: 1 }],
      isMonastery: true,
      followers: [],
    }

    const points = calcMonasteryPoints(board, monastery)

    expect(points).toBe(9)
  })

  it('пропуски в окрестности учитываются: 4 из 9 клеток заняты', () => {
    const board = boardOf([
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 2],
    ])
    board[1][1] = gridTile({ x: 1, y: 1, isMonastery: true })
    const monastery: BaseObject = {
      id: 'monastery-partial',
      points: [{ x: 1, y: 1 }],
      isMonastery: true,
      followers: [],
    }

    const points = calcMonasteryPoints(board, monastery)

    // заняты: (0,1), (1,0), (1,1), (2,2) — ровно 4
    expect(points).toBe(4)
  })

  it('монастырь без точки не даёт очков', () => {
    const monastery: BaseObject = {
      id: 'monastery-empty',
      points: [],
      isMonastery: true,
      followers: [],
    }

    const points = calcMonasteryPoints({}, monastery)

    expect(points).toBe(0)
  })
})

describe('calcGardenPoints', () => {
  it('изолированный сад даёт 1 очко (только сам тайл)', () => {
    const board = boardOf([[0, 0]])
    const garden: BaseObject = {
      id: 'garden-1',
      points: [{ x: 0, y: 0 }],
      isGarden: true,
      followers: [],
    }

    const points = calcGardenPoints(board, garden)

    expect(points).toBe(1)
  })

  it('сад в окружении 3×3 даёт 9 очков', () => {
    const board = boardOf([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ])
    const garden: BaseObject = {
      id: 'garden-full',
      points: [{ x: 1, y: 1 }],
      isGarden: true,
      followers: [],
    }

    const points = calcGardenPoints(board, garden)

    expect(points).toBe(9)
  })

  it('сад без точки не даёт очков', () => {
    const garden: BaseObject = {
      id: 'garden-empty',
      points: [],
      isGarden: true,
      followers: [],
    }

    const points = calcGardenPoints({}, garden)

    expect(points).toBe(0)
  })
})
