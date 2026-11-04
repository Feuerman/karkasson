import { ref } from 'vue'
import type { FollowerType, Point } from '@server/modules/types'

export type BoardZoomHandler = (cell: {
  rowIndex: number
  tileIndex: number
}) => void

export type FollowerPlacementPreview = {
  point: Point
  followerType: FollowerType
  playerColor: string
} | null

const zoomHandler = ref<BoardZoomHandler | null>(null)
const fairyTargetPreview = ref<{
  rowIndex: number
  tileIndex: number
} | null>(null)
const followerPlacementPreview = ref<FollowerPlacementPreview>(null)

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

  const setFollowerPlacementPreview = (
    point: Point,
    followerType: FollowerType,
    playerColor: string
  ) => {
    followerPlacementPreview.value = { point, followerType, playerColor }
  }

  const clearFollowerPlacementPreview = () => {
    followerPlacementPreview.value = null
  }

  return {
    setZoomHandler,
    zoomToTile,
    fairyTargetPreview,
    setFairyTargetPreview,
    followerPlacementPreview,
    setFollowerPlacementPreview,
    clearFollowerPlacementPreview,
  }
}
