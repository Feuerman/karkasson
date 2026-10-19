import type { AvailablePlace } from '@server/modules/types'

/**
 * Ключ клетки доски: `rowIndex:tileIndex`.
 *
 * Ключ один на весь интерфейс: по нему и доступные клетки собираются во
 * множество, и конфликты размещения отмечаются.
 */
export const boardCellKey = (rowIndex: number, tileIndex: number): string =>
  `${rowIndex}:${tileIndex}`

/**
 * Клетки, в которых сервер разрешает поставить тайл.
 *
 * Список приходит с сервером вместе с состоянием партии: это свободные
 * соседи уже выложенных тайлов. Подсветка по нему — подсказка игроку,
 * решение о размещении по-прежнему принимает сервер.
 */
export const buildAvailableCells = (
  places?: AvailablePlace[] | null
): Set<string> => {
  const cells = new Set<string>()

  for (const place of places ?? []) {
    if (typeof place?.rowIndex !== 'number') continue
    if (typeof place?.tileIndex !== 'number') continue
    cells.add(boardCellKey(place.rowIndex, place.tileIndex))
  }

  return cells
}
