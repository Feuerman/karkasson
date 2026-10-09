import { describe, expect, it } from 'vitest'
import {
  calcCityScore,
  calcRoadScore,
  describeCentralObjectPoints,
  describeCityScore,
  describeCompletedCentralObject,
  describeRoadScore,
} from '@server/modules/scoring'
import {
  ExpansionName,
  SideName,
  TileId,
  TileSideType,
} from '@server/modules/types'
import type {
  BaseObject,
  GridTile,
  Scores,
  TilePlacesStats,
} from '@server/modules/types'

/**
 * Детализация начисления должна сходиться с реально начисленной суммой:
 * сумма строк равна очкам, а бонусы совпадают с правилами дополнения.
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

const follower = { playerId: 1, objectId: 'obj', point: { x: 0, y: 0 } }
const scores = (): Scores => ({})

const sumOf = (details: Array<{ total: number }>): number =>
  details.reduce((sum, line) => sum + line.total, 0)

describe('describeRoadScore', () => {
  const roadOf = (points: Array<[number, number]>, extra = {}): BaseObject => ({
    id: 'road',
    points: points.map(([x, y]) => ({ x, y })),
    followers: [follower],
    ...extra,
  })

  it('показывает 1 очко за каждый тайл обычной дороги', () => {
    const road = roadOf([
      [0, 0],
      [1, 0],
      [2, 0],
    ])
    const board = boardOf([
      [0, 0],
      [0, 1],
      [0, 2],
    ])

    const { details, modifiers } = describeRoadScore(board, road)
    expect(details).toEqual([
      { label: 'Тайлы дороги', count: 3, pointsPerUnit: 1, total: 3 },
    ])
    expect(modifiers).toEqual([])
    expect(sumOf(details)).toBe(calcRoadScore(board, road, scores()).total)
  })

  it('учитывает таверну: 2 очка за тайл и упоминает бонус', () => {
    const road = roadOf(
      [
        [0, 0],
        [1, 0],
      ],
      { hasInn: true }
    )
    const board = boardOf([
      [0, 0],
      [0, 1],
    ])

    const { details, modifiers } = describeRoadScore(board, road, true, true)
    expect(details).toEqual([
      { label: 'Тайлы дороги', count: 2, pointsPerUnit: 2, total: 4 },
    ])
    expect(modifiers).toEqual(['Таверна: 2 очка за каждый тайл дороги'])
    expect(sumOf(details)).toBe(
      calcRoadScore(board, road, scores(), true, true).total
    )
  })

  it('незавершённая дорога с таверной даёт 0 очков', () => {
    const road = roadOf([[0, 0]], { hasInn: true })
    const board = boardOf([[0, 0]])

    const { details, modifiers } = describeRoadScore(board, road, false, true)
    expect(sumOf(details)).toBe(0)
    expect(modifiers).toEqual([
      'Таверна: незавершённая дорога приносит 0 очков',
    ])
    expect(sumOf(details)).toBe(
      calcRoadScore(board, road, scores(), false, true).total
    )
  })

  it('объект из дополнения засчитывает таверну без отдельной настройки', () => {
    const road = roadOf([[0, 0]], {
      expansion: ExpansionName.InnsAndCathedrals,
    })
    const board = boardOf([[0, 0]])

    const { details } = describeRoadScore(board, road, true, false)
    expect(details[0]).toMatchObject({ count: 1, pointsPerUnit: 2, total: 2 })
    expect(sumOf(details)).toBe(
      calcRoadScore(board, road, scores(), true, false).total
    )
  })
})

describe('describeCityScore', () => {
  const cityOf = (points: Array<[number, number]>, extra = {}): BaseObject => ({
    id: 'city',
    points: points.map(([x, y]) => ({ x, y })),
    followers: [follower],
    ...extra,
  })

  it('показывает тайлы и гербы города с 2 очками за каждую единицу', () => {
    const city = cityOf([
      [0, 0],
      [1, 0],
    ])
    const board = boardOf([
      [0, 0, { withShield: true }],
      [0, 1],
    ])

    const { details, modifiers } = describeCityScore(board, city)
    expect(details).toEqual([
      { label: 'Тайлы города', count: 2, pointsPerUnit: 2, total: 4 },
      { label: 'Гербы в городе', count: 1, pointsPerUnit: 2, total: 2 },
    ])
    expect(modifiers).toEqual([])
    expect(sumOf(details)).toBe(calcCityScore(board, city, scores()).total)
  })

  it('собор поднимает ставку до 3 очков за тайл и герб', () => {
    const city = cityOf(
      [
        [0, 0],
        [1, 0],
      ],
      { hasCathedral: true }
    )
    const board = boardOf([
      [0, 0, { withShield: true }],
      [0, 1],
    ])

    const { details, modifiers } = describeCityScore(board, city, true, true)
    expect(details).toEqual([
      { label: 'Тайлы города', count: 2, pointsPerUnit: 3, total: 6 },
      { label: 'Гербы в городе', count: 1, pointsPerUnit: 3, total: 3 },
    ])
    expect(modifiers).toEqual(['Собор: 3 очка за каждый тайл и герб города'])
    expect(sumOf(details)).toBe(
      calcCityScore(board, city, scores(), true, true).total
    )
  })

  it('незавершённый город с собором даёт 0 очков и нулевые строки', () => {
    const city = cityOf([[0, 0]], { hasCathedral: true })
    const board = boardOf([[0, 0]])

    const { details, modifiers } = describeCityScore(board, city, false, true)
    expect(details).toEqual([
      { label: 'Тайлы города', count: 1, pointsPerUnit: 1, total: 0 },
    ])
    expect(modifiers).toEqual(['Собор: незавершённый город приносит 0 очков'])
    expect(sumOf(details)).toBe(
      calcCityScore(board, city, scores(), false, true).total
    )
  })

  it('незавершённый город без собора даёт по 1 очку за тайл и герб', () => {
    const city = cityOf([
      [0, 0],
      [1, 0],
    ])
    const board = boardOf([
      [0, 0, { withShield: true }],
      [0, 1],
    ])

    const { details } = describeCityScore(board, city, false, false)
    expect(details).toEqual([
      { label: 'Тайлы города', count: 2, pointsPerUnit: 1, total: 2 },
      { label: 'Гербы в городе', count: 1, pointsPerUnit: 1, total: 1 },
    ])
    expect(sumOf(details)).toBe(
      calcCityScore(board, city, scores(), false, false).total
    )
  })
})

describe('describeCentralObjectPoints', () => {
  it('делит очки на сам тайл и занятые клетки вокруг', () => {
    expect(describeCentralObjectPoints(9, 'монастыря').details).toEqual([
      { label: 'Тайл монастыря', count: 1, pointsPerUnit: 1, total: 1 },
      {
        label: 'Занятые клетки вокруг',
        count: 8,
        pointsPerUnit: 1,
        total: 8,
      },
    ])
  })

  it('для сада называет тайл сада', () => {
    const { details } = describeCentralObjectPoints(3, 'сада')
    expect(details[0]).toEqual({
      label: 'Тайл сада',
      count: 1,
      pointsPerUnit: 1,
      total: 1,
    })
    expect(sumOf(details)).toBe(3)
  })

  it('один тайл без занятых клеток не даёт пустой строки', () => {
    expect(describeCentralObjectPoints(1, 'монастыря').details).toHaveLength(1)
  })

  it('нулевые очки не показываются как заработанные', () => {
    const { details } = describeCentralObjectPoints(0, 'монастыря')
    expect(sumOf(details)).toBe(0)
    expect(details[0]).toMatchObject({ count: 1, total: 0 })
  })
})

describe('describeCompletedCentralObject', () => {
  it('завершённый монастырь всегда приносит 9 очков', () => {
    expect(describeCompletedCentralObject('монастыря')).toEqual({
      details: [
        {
          label: 'Завершённый монастырь',
          count: 1,
          pointsPerUnit: 9,
          total: 9,
        },
      ],
      modifiers: [],
    })
  })

  it('завершённый сад всегда приносит 9 очков', () => {
    const { details } = describeCompletedCentralObject('сада')
    expect(details).toEqual([
      { label: 'Завершённый сад', count: 1, pointsPerUnit: 9, total: 9 },
    ])
    expect(sumOf(details)).toBe(9)
  })
})
