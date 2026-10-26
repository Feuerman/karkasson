import { ref } from 'vue'

export type BoardZoomHandler = (cell: {
  rowIndex: number
  tileIndex: number
}) => void

const zoomHandler = ref<BoardZoomHandler | null>(null)

/**
 * Связывает доску и элементы интерфейса, которые просят показать клетку.
 * Игровая доска регистрирует свой обработчик при монтировании; сводка хода
 * и история могут вызвать пролистывание к клетке без прямой ссылки на компонент.
 */
export function useBoardZoom() {
  const setZoomHandler = (handler: BoardZoomHandler) => {
    zoomHandler.value = handler
  }

  const zoomToTile = (cell: { rowIndex: number; tileIndex: number }) => {
    zoomHandler.value?.(cell)
  }

  return { setZoomHandler, zoomToTile }
}
