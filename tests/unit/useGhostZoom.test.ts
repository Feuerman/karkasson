// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { useGhostZoom } from '@/composables/useGhostZoom'
import { TILE_SIZE } from '@/utils/tiles'

/**
 * Превью тайла повторяет масштаб доски: рамка растягивается под размер
 * тайла, а сам тайл масштабируется. Пока превью не смонтировано, применение
 * зума должно быть безопасным и сообщать об отказе.
 */

function createGhost() {
  const ghost = useGhostZoom()
  const preview = document.createElement('div')
  const frame = document.createElement('div')
  ghost.previewRef.value = preview
  ghost.frameRef.value = frame
  return { ghost, preview, frame }
}

describe('Масштаб превью тайла', () => {
  it('масштабирует превью и возвращает его к исходному размеру', () => {
    const { ghost, preview, frame } = createGhost()

    expect(ghost.applyZoom(1.5)).toBe(true)
    expect(preview.style.transform).toBe('scale(1.5)')
    expect(frame.style.width).toBe(`${TILE_SIZE * 1.5}px`)
    expect(frame.style.height).toBe(`${TILE_SIZE * 1.5}px`)

    ghost.applyZoom(1)

    expect(preview.style.transform).toBe('scale(1)')
    expect(frame.style.width).toBe(`${TILE_SIZE}px`)
    expect(frame.style.height).toBe(`${TILE_SIZE}px`)
  })

  it.each([
    ['не смонтировано', false, false],
    ['смонтирована только часть превью', true, false],
  ])(
    'не применяет зум, если превью %s',
    (_description, hasPreview, hasFrame) => {
      const ghost = useGhostZoom()
      const preview = hasPreview ? document.createElement('div') : null
      const frame = hasFrame ? document.createElement('div') : null
      ghost.previewRef.value = preview
      ghost.frameRef.value = frame

      expect(ghost.applyZoom(2)).toBe(false)
      expect(preview?.style.transform ?? '').toBe('')
    }
  )

  it('переносит масштаб на новое превью после повторного монтирования', () => {
    const ghost = useGhostZoom()
    const preview = document.createElement('div')
    const frame = document.createElement('div')
    ghost.previewRef.value = preview
    ghost.frameRef.value = frame

    expect(ghost.applyZoom(2)).toBe(true)

    ghost.previewRef.value = null
    ghost.frameRef.value = null
    expect(ghost.applyZoom(2)).toBe(false)

    const nextPreview = document.createElement('div')
    const nextFrame = document.createElement('div')
    ghost.previewRef.value = nextPreview
    ghost.frameRef.value = nextFrame

    expect(ghost.applyZoom(2)).toBe(true)
    expect(nextPreview.style.transform).toBe('scale(2)')
    expect(nextFrame.style.width).toBe(`${TILE_SIZE * 2}px`)
  })
})
