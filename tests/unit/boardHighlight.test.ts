// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { highlightCells, scrollToTile } from '@/utils/board'

/**
 * Подсветка объекта из истории работает с реальными клетками доски: класс,
 * длительность и задержка задаются прямо в стилях элемента, а снятие
 * отложено по времени. Здесь нужен DOM, поэтому файл запускается в happy-dom.
 */

const HIGHLIGHT_CLASS = 'tile-focus'
const DURATION_PROPERTY = '--tile-focus-duration'
const DELAY_PROPERTY = '--tile-focus-delay'

function addTile(rowIndex: number, tileIndex: number): HTMLElement {
  const element = document.createElement('div')
  element.dataset.rowIndex = String(rowIndex)
  element.dataset.tileIndex = String(tileIndex)
  document.body.appendChild(element)
  return element
}

function cell(rowIndex: number, tileIndex: number) {
  return { rowIndex, tileIndex }
}

let scrollIntoView: ReturnType<typeof vi.fn>

beforeEach(() => {
  document.body.innerHTML = ''
  vi.useFakeTimers()
  scrollIntoView = vi.fn()
  Element.prototype.scrollIntoView =
    scrollIntoView as unknown as Element['scrollIntoView']
})

afterEach(() => {
  vi.useRealTimers()
})

describe('scrollToTile', () => {
  it('прокручивает к существующей клетке и центрирует её', () => {
    const tile = addTile(12, 20)

    scrollToTile(12, 20)

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(tile.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    })
  })

  it('передаёт заданное поведение прокрутки', () => {
    addTile(12, 20)

    scrollToTile(12, 20, 'auto')

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'center',
      inline: 'center',
    })
  })
})

describe('highlightCells', () => {
  it('помечает все клетки объекта и прокручивает к первой', () => {
    const first = addTile(12, 20)
    const second = addTile(12, 21)
    const third = addTile(12, 22)

    highlightCells([cell(12, 20), cell(12, 21), cell(12, 22)])

    for (const tile of [first, second, third]) {
      expect(tile.classList.contains(HIGHLIGHT_CLASS)).toBe(true)
    }
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(first.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('задаёт задержку по порядку клеток, чтобы подсветка шла вдоль дороги', () => {
    const first = addTile(12, 20)
    const second = addTile(12, 21)
    const third = addTile(12, 22)

    highlightCells([cell(12, 20), cell(12, 21), cell(12, 22)])

    expect(first.style.getPropertyValue(DELAY_PROPERTY)).toBe('0ms')
    expect(second.style.getPropertyValue(DELAY_PROPERTY)).toBe('90ms')
    expect(third.style.getPropertyValue(DELAY_PROPERTY)).toBe('180ms')
  })

  it('одинаковую длительность подсветки для всех клеток', () => {
    const tile = addTile(12, 20)

    highlightCells([cell(12, 20)], 1000)

    expect(tile.style.getPropertyValue(DURATION_PROPERTY)).toBe('1000ms')
  })

  it('подсвечивает только те клетки, что есть на доске', () => {
    const existing = addTile(12, 20)

    highlightCells([cell(12, 20), cell(99, 99)])

    expect(existing.classList.contains(HIGHLIGHT_CLASS)).toBe(true)
    expect(document.querySelectorAll(`.${HIGHLIGHT_CLASS}`)).toHaveLength(1)
  })

  it.each([
    [[], 'пустого списка'],
    [[{ rowIndex: 12 }], 'неполной клетки'],
  ])('для %s (%s) не вызывает прокрутку', (cells) => {
    const cancel = highlightCells(cells)

    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(() => cancel()).not.toThrow()
  })

  it('сохраняет подсветку до конца задержки, затем снимает её и стили', () => {
    const first = addTile(12, 20)
    const second = addTile(12, 21)

    highlightCells([cell(12, 20), cell(12, 21)], 1000)
    // Последняя клетка задержана на 90 мс: до 1090 мс подсветка сохраняется.
    vi.advanceTimersByTime(1000 + 90 - 1)
    expect(first.classList.contains(HIGHLIGHT_CLASS)).toBe(true)
    expect(second.classList.contains(HIGHLIGHT_CLASS)).toBe(true)

    vi.advanceTimersByTime(1)

    for (const tile of [first, second]) {
      expect(tile.classList.contains(HIGHLIGHT_CLASS)).toBe(false)
      expect(tile.style.getPropertyValue(DURATION_PROPERTY)).toBe('')
      expect(tile.style.getPropertyValue(DELAY_PROPERTY)).toBe('')
    }
  })

  it('отмена снимает подсветку сразу и отменяет отложенное снятие', () => {
    const first = addTile(12, 20)
    const second = addTile(12, 21)

    const cancel = highlightCells([cell(12, 20), cell(12, 21)], 1000)
    cancel()

    expect(first.classList.contains(HIGHLIGHT_CLASS)).toBe(false)
    expect(second.classList.contains(HIGHLIGHT_CLASS)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('отмена подсветки одного объекта не снимает подсветку другого', () => {
    const first = addTile(12, 20)
    const second = addTile(12, 21)

    const cancelFirst = highlightCells([cell(12, 20)], 1000)
    highlightCells([cell(12, 21)], 1000)
    cancelFirst()

    expect(first.classList.contains(HIGHLIGHT_CLASS)).toBe(false)
    expect(second.classList.contains(HIGHLIGHT_CLASS)).toBe(true)

    // Подсветка второго объекта держится до конца своей длительности
    vi.advanceTimersByTime(1000)
    expect(second.classList.contains(HIGHLIGHT_CLASS)).toBe(false)
  })
})
