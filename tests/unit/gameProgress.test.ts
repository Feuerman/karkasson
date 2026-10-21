import { describe, expect, it } from 'vitest'
import type { GridTile, TemporaryObjects } from '@server/modules/types'
import {
  buildGameProgress,
  countObjects,
  countPlacedTiles,
  progressPercent,
} from '@/utils/gameProgress'

/**
 * Панель партии показывает ход игры в числах: сколько плиток ушло на доску,
 * сколько осталось в колоде и сколько объектов в игре. Все числа берутся из
 * серверного снимка, поэтому проверяется разбор этого снимка.
 */

const tile = (id: string): GridTile => ({
  id,
  rotation: 0,
  x: 0,
  y: 0,
  sides: {} as GridTile['sides'],
})

const placedTiles = (): Record<number, Record<number, GridTile>> => ({
  14: { 15: tile('A'), 16: tile('B') },
  15: { 15: tile('C') },
})

const objects = (
  cities: number,
  roads: number,
  monasteries: number,
  gardens: number
): TemporaryObjects => ({
  cities: Array.from({ length: cities }, (_, index) => ({
    id: `city-${index}`,
    points: [],
    followers: [],
  })),
  roads: Array.from({ length: roads }, (_, index) => ({
    id: `road-${index}`,
    points: [],
    followers: [],
  })),
  monasteries: Array.from({ length: monasteries }, (_, index) => ({
    id: `monastery-${index}`,
    points: [],
    followers: [],
  })),
  gardens: Array.from({ length: gardens }, (_, index) => ({
    id: `garden-${index}`,
    points: [],
    followers: [],
  })),
})

const currentTile = tile('D')

describe('countPlacedTiles', () => {
  it('считает плитки на доске', () => {
    expect(countPlacedTiles(placedTiles())).toBe(3)
  })

  it('для пустой доски даёт ноль', () => {
    expect(countPlacedTiles({})).toBe(0)
  })

  it('для отсутствующей доски даёт ноль', () => {
    expect(countPlacedTiles()).toBe(0)
    expect(countPlacedTiles(null)).toBe(0)
  })
})

describe('countObjects', () => {
  it('считает объекты каждого вида', () => {
    expect(countObjects(objects(2, 5, 1, 3))).toEqual({
      cities: 2,
      roads: 5,
      monasteries: 1,
      gardens: 3,
    })
  })

  it('для отсутствующих объектов даёт нули', () => {
    expect(countObjects()).toEqual({
      cities: 0,
      roads: 0,
      monasteries: 0,
      gardens: 0,
    })
  })
})

describe('buildGameProgress', () => {
  it('считает плитки на доске, в колоде и на руках', () => {
    const progress = buildGameProgress({
      tilePlacesStats: placedTiles(),
      tilesCount: 2,
      currentTile,
    })

    expect(progress.placedTiles).toBe(3)
    expect(progress.remainingTiles).toBe(2)
    expect(progress.totalTiles).toBe(6)
  })

  it('объекты на доске считаются вместе с завершёнными', () => {
    const progress = buildGameProgress({
      temporaryObjects: objects(1, 2, 0, 1),
      completedObjects: objects(2, 1, 1, 0),
    })

    expect(progress.temporaryObjects.cities).toBe(1)
    expect(progress.completedObjects.cities).toBe(2)
    expect(progress.objects).toEqual({
      cities: 3,
      roads: 3,
      monasteries: 1,
      gardens: 1,
    })
  })

  it('для пустого снимка не падает и даёт нули', () => {
    const progress = buildGameProgress({})

    expect(progress.placedTiles).toBe(0)
    expect(progress.remainingTiles).toBe(0)
    expect(progress.totalTiles).toBe(0)
    expect(progress.objects).toEqual({
      cities: 0,
      roads: 0,
      monasteries: 0,
      gardens: 0,
    })
  })
})

describe('progressPercent', () => {
  it('показывает долю выложенных плиток', () => {
    const progress = buildGameProgress({
      tilePlacesStats: placedTiles(),
      tilesCount: 5,
      currentTile,
    })

    expect(progressPercent(progress)).toBe(33)
  })

  it('для пустой партии даёт ноль', () => {
    expect(progressPercent(buildGameProgress({}))).toBe(0)
  })
})
