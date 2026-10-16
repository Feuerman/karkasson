import { describe, expect, it } from 'vitest'
import { cellOfPoint, cellsOfPoints } from '@/utils/board'
import type { Point } from '@server/modules/types'

/**
 * Точки сервера заданы как X — столбец, Y — строка, а доска адресуется
 * наоборот: rowIndex — Y, tileIndex — X. Подсветка объекта из истории идёт по
 * клеткам, поэтому перестановка осей и порядок клеток проверяются явно.
 */

function point(x: number, y: number): Point {
  return { x, y }
}

describe('cellOfPoint', () => {
  it.each([
    [10, 20, { rowIndex: 20, tileIndex: 10 }],
    [0, 31, { rowIndex: 31, tileIndex: 0 }],
  ])('точка (%i, %i) преобразуется в ожидаемую клетку', (x, y, expected) => {
    expect(cellOfPoint(point(x, y))).toEqual(expected)
  })
})

describe('cellsOfPoints', () => {
  it('для дороги отдаёт клетки по порядку точек объекта', () => {
    expect(
      cellsOfPoints([point(10, 12), point(11, 12), point(12, 12)])
    ).toEqual([
      { rowIndex: 12, tileIndex: 10 },
      { rowIndex: 12, tileIndex: 11 },
      { rowIndex: 12, tileIndex: 12 },
    ])
  })

  it('убирает повтор клетки и сохраняет порядок первого появления', () => {
    expect(
      cellsOfPoints([point(12, 10), point(10, 12), point(12, 10)])
    ).toEqual([
      { rowIndex: 10, tileIndex: 12 },
      { rowIndex: 12, tileIndex: 10 },
    ])
  })

  it('различает клетки, у которых совпадает только одна координата', () => {
    expect(
      cellsOfPoints([point(10, 12), point(12, 10), point(12, 12)])
    ).toEqual([
      { rowIndex: 12, tileIndex: 10 },
      { rowIndex: 10, tileIndex: 12 },
      { rowIndex: 12, tileIndex: 12 },
    ])
  })

  it('для отсутствующего списка точек возвращает пустой список', () => {
    expect(cellsOfPoints(undefined)).toEqual([])
  })
})
