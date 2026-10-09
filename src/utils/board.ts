import type { Point } from '@server/modules/types'

export interface TileCoordinates {
  rowIndex?: number
  tileIndex?: number
}

export const findTileElement = (
  rowIndex: number,
  tileIndex: number
): HTMLElement | null =>
  document.querySelector<HTMLElement>(
    `[data-row-index="${rowIndex}"][data-tile-index="${tileIndex}"]`
  )

const SCROLL_ALIGNMENT: ScrollLogicalPosition = 'center'

const scrollToElement = (
  element: HTMLElement,
  behavior: ScrollBehavior = 'smooth'
): void => {
  element.scrollIntoView({
    behavior,
    block: SCROLL_ALIGNMENT,
    inline: SCROLL_ALIGNMENT,
  })
}

export const scrollToTile = (
  rowIndex: number,
  tileIndex: number,
  behavior: ScrollBehavior = 'smooth'
): void => {
  const element = findTileElement(rowIndex, tileIndex)
  if (element) scrollToElement(element, behavior)
}

/** Клетка доски, в которой стоит объект или фишка: X — столбец, Y — строка. */
export const cellOfPoint = (point: Point): TileCoordinates => ({
  rowIndex: point.y,
  tileIndex: point.x,
})

/**
 * Клетки доски, занятые объектом, без повторов и в порядке точек объекта.
 * Дорога и город занимают несколько клеток, монастырь и сад — одну.
 */
export const cellsOfPoints = (
  points: readonly Point[] | undefined
): TileCoordinates[] => {
  const cells = new Map<string, TileCoordinates>()
  for (const point of points ?? []) {
    const cell = cellOfPoint(point)
    cells.set(`${cell.rowIndex}:${cell.tileIndex}`, cell)
  }
  return [...cells.values()]
}

const HIGHLIGHT_CLASS = 'tile-focus'
const HIGHLIGHT_DURATION_PROPERTY = '--tile-focus-duration'
const HIGHLIGHT_DELAY_PROPERTY = '--tile-focus-delay'
const HIGHLIGHT_DURATION = 2600
/** Задержка между соседними клетками объекта: подсветка идёт вдоль дороги. */
const HIGHLIGHT_STAGGER = 90

const toTileElements = (cells: readonly TileCoordinates[]): HTMLElement[] => {
  const elements = cells.flatMap((cell) => {
    if (cell.rowIndex === undefined || cell.tileIndex === undefined) return []
    const element = findTileElement(cell.rowIndex, cell.tileIndex)
    return element ? [element] : []
  })
  return [...new Set(elements)]
}

/**
 * Подсвечивает клетки доски и прокручивает к первой из них. Возвращает
 * функцию отмены: она снимает выделение и отменяет отложенное снятие, чтобы
 * повторный клик по другой записи истории не остался без подсветки.
 */
export const highlightCells = (
  cells: readonly TileCoordinates[],
  duration: number = HIGHLIGHT_DURATION
): (() => void) => {
  const elements = toTileElements(cells)
  if (!elements.length) return () => undefined

  scrollToElement(elements[0])

  elements.forEach((element, index) => {
    element.style.setProperty(HIGHLIGHT_DURATION_PROPERTY, `${duration}ms`)
    element.style.setProperty(
      HIGHLIGHT_DELAY_PROPERTY,
      `${index * HIGHLIGHT_STAGGER}ms`
    )
    element.classList.add(HIGHLIGHT_CLASS)
  })

  const clear = () => {
    elements.forEach((element) => {
      element.classList.remove(HIGHLIGHT_CLASS)
      element.style.removeProperty(HIGHLIGHT_DURATION_PROPERTY)
      element.style.removeProperty(HIGHLIGHT_DELAY_PROPERTY)
    })
  }

  const lastDelay = (elements.length - 1) * HIGHLIGHT_STAGGER
  const timeout = setTimeout(clear, duration + lastDelay)

  return () => {
    clearTimeout(timeout)
    clear()
  }
}
