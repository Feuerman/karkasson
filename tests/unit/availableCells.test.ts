import { describe, expect, it } from 'vitest'
import type { AvailablePlace } from '@server/modules/types'
import { boardCellKey, buildAvailableCells } from '@/utils/availableCells'

/**
 * Список доступных клеток приходит с сервером и превращается в множество
 * ключей: так подсветка на доске проверяется одним поиском, а не обходом
 * списка для каждой клетки.
 */

const place = (rowIndex: number, tileIndex: number): AvailablePlace => ({
  rowIndex,
  tileIndex,
  objects: [],
})

describe('boardCellKey', () => {
  it('строит ключ из координат клетки', () => {
    expect(boardCellKey(15, 16)).toBe('15:16')
  })
})

describe('buildAvailableCells', () => {
  it('собирает ключи всех доступных клеток', () => {
    const cells = buildAvailableCells([
      place(14, 15),
      place(16, 15),
      place(15, 14),
      place(15, 16),
    ])

    expect([...cells].sort()).toEqual(['14:15', '15:14', '15:16', '16:15'])
  })

  it('для пустого списка даёт пустое множество', () => {
    expect(buildAvailableCells([]).size).toBe(0)
  })

  it('для отсутствующего списка даёт пустое множество', () => {
    expect(buildAvailableCells().size).toBe(0)
    expect(buildAvailableCells(null).size).toBe(0)
  })

  it('пропускает записи без координат', () => {
    const cells = buildAvailableCells([
      place(15, 16),
      { rowIndex: 15 } as unknown as AvailablePlace,
      { tileIndex: 16 } as unknown as AvailablePlace,
    ])

    expect([...cells]).toEqual(['15:16'])
  })

  it('не добавляет одну клетку дважды', () => {
    const cells = buildAvailableCells([place(15, 16), place(15, 16)])

    expect(cells.size).toBe(1)
  })
})
