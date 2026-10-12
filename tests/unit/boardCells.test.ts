import { describe, expect, it } from 'vitest'
import { cellOfPoint, cellsOfPoints } from '@/utils/board'
import { PointDirection, type Point } from '@server/modules/types'

/**
 * Точки сервера заданы как X — столбец, Y — строка, а доска адресуется
 * наоборот: rowIndex — Y, tileIndex — X. Подсветка объекта из истории идёт по
 * клеткам, поэтому перестановка осей и порядок клеток проверяются явно.
 */

function point(x: number, y: number, direction?: PointDirection): Point {
  return direction ? { x, y, direction } : { x, y }
}

describe('cellOfPoint', () => {
  it.each([
    [10, 20, { rowIndex: 20, tileIndex: 10 }],
    [15, 15, { rowIndex: 15, tileIndex: 15 }],
    [0, 31, { rowIndex: 31, tileIndex: 0 }],
  ])('точка (%i, %i) → строка %i, столбец %i', (x, y, expected) => {
    expect(cellOfPoint(point(x, y))).toEqual(expected)
  })

  it('не зависит от направления точки', () => {
    expect(cellOfPoint(point(10, 20, PointDirection.West))).toEqual({
      rowIndex: 20,
      tileIndex: 10,
    })
  })
})

describe('cellsOfPoints', () => {
  it('для монастыря и сада отдаёт единственную клетку', () => {
    expect(cellsOfPoints([point(12, 14, PointDirection.Center)])).toEqual([
      { rowIndex: 14, tileIndex: 12 },
    ])
  })

  it('для дороги отдаёт клетки по порядку точек объекта', () => {
    expect(
      cellsOfPoints([
        point(10, 12, PointDirection.East),
        point(11, 12, PointDirection.West),
        point(12, 12, PointDirection.West),
      ])
    ).toEqual([
      { rowIndex: 12, tileIndex: 10 },
      { rowIndex: 12, tileIndex: 11 },
      { rowIndex: 12, tileIndex: 12 },
    ])
  })

  it('убирает повтор клетки, но сохраняет позицию первой встречи', () => {
    expect(
      cellsOfPoints([
        point(12, 10, PointDirection.East),
        point(12, 10, PointDirection.West),
        point(10, 12, PointDirection.South),
        point(12, 10, PointDirection.North),
      ])
    ).toEqual([
      { rowIndex: 10, tileIndex: 12 },
      { rowIndex: 12, tileIndex: 10 },
    ])
  })

  it('различает клетки, у которых совпадает только одна координата', () => {
    expect(
      cellsOfPoints([point(10, 12), point(12, 10), point(12, 12)])
    ).toHaveLength(3)
  })

  it.each([[], undefined])(
    'для пустого списка точек (%s) возвращает пустой список',
    (points) => {
      expect(cellsOfPoints(points)).toEqual([])
    }
  )
})
