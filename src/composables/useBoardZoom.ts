import { ref } from 'vue'
import type { Point } from '@server/modules/types'

export type BoardZoomHandler = (cell: {
  rowIndex: number
  tileIndex: number
}) => void

const zoomHandler = ref<BoardZoomHandler | null>(null)
const fairyTargetPreview = ref<{
  rowIndex: number
  tileIndex: number
} | null>(null)
const followerPlacementPreview = ref<Point | null>(null)

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

  const setFairyTargetPreview = (
    cell: { rowIndex: number; tileIndex: number } | null
  ) => {
    fairyTargetPreview.value = cell
  }

  const setFollowerPlacementPreview = (point: Point | null) => {
    followerPlacementPreview.value = point
  }

  return {
    setZoomHandler,
    zoomToTile,
    fairyTargetPreview,
    setFairyTargetPreview,
    followerPlacementPreview,
    setFollowerPlacementPreview,
  }
}
