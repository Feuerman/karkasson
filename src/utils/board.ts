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

export const scrollToTile = (
  rowIndex: number,
  tileIndex: number,
  behavior: ScrollBehavior = 'smooth'
): void => {
  findTileElement(rowIndex, tileIndex)?.scrollIntoView({
    behavior,
    block: SCROLL_ALIGNMENT,
    inline: SCROLL_ALIGNMENT,
  })
}

export const pulseTile = (
  rowIndex: number,
  tileIndex: number
): (() => void) => {
  const element = findTileElement(rowIndex, tileIndex)
  if (!element) return () => undefined

  element.classList.add('tile-pulse')

  const timeout = setTimeout(() => {
    element.classList.remove('tile-pulse')
  }, 1000)

  return () => {
    clearTimeout(timeout)
    element.classList.remove('tile-pulse')
  }
}
