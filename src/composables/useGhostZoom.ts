import { ref } from 'vue'
import { TILE_SIZE } from '@/utils/tiles'

/**
 * Превью тайла повторяет масштаб доски. Пока превью не смонтировано, ref'ы
 * пустые, поэтому применение зума проверяет их и сообщает, удалось ли
 * применить, — вызывающий код решает, когда повторить.
 */
export const useGhostZoom = () => {
  const previewRef = ref<HTMLElement | null>(null)
  const frameRef = ref<HTMLElement | null>(null)

  const applyZoom = (zoom: number): boolean => {
    const preview = previewRef.value
    const frame = frameRef.value
    if (!preview || !frame) return false

    preview.style.transform = `scale(${zoom})`
    frame.style.width = `${TILE_SIZE * zoom}px`
    frame.style.height = `${TILE_SIZE * zoom}px`
    return true
  }

  return { previewRef, frameRef, applyZoom }
}
