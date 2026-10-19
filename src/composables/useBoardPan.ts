import { onBeforeUnmount, onMounted, ref } from 'vue'

const DRAG_THRESHOLD_PX = 5
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
/** Шаг кнопок приближения и отдаления. */
const ZOOM_STEP = 0.25
/**
 * Пауза, в течение которого мышь не управляет доской.
 *
 * После касания браузер повторяет его как события мыши: без паузы доска
 * дёргалась бы дважды, а касание, оказавшееся прокруткой, выбирало бы клетку.
 */
const TOUCH_TO_MOUSE_GUARD_MS = 700

export interface BoardPanOptions {
  onZoomChange?: (zoom: number) => void
}

export const useBoardPan = (options: BoardPanOptions = {}) => {
  const boardRef = ref<HTMLElement | null>(null)
  const planeRef = ref<HTMLElement | null>(null)
  const sizeBoxRef = ref<HTMLElement | null>(null)
  const isPanning = ref(false)
  const canReset = ref(false)
  /** Текущий масштаб доски: от 0.5 до 3. */
  const zoom = ref(1)

  let baseWidth = 0
  let baseHeight = 0
  let resizeObserver: ResizeObserver | null = null

  let startClientX = 0
  let startClientY = 0
  let startScrollLeft = 0
  let startScrollTop = 0
  let dragged = false
  let suppressNextClick = false

  /** Состояние щипка двумя пальцами. */
  let isPinching = false
  let pinchStartDistance = 0
  let pinchStartZoom = 1
  let pinchStartMidX = 0
  let pinchStartMidY = 0
  let pinchStartScrollLeft = 0
  let pinchStartScrollTop = 0

  let ignoreMouseUntil = 0

  const applyZoom = (nextZoom: number) => {
    const plane = planeRef.value
    const sizeBox = sizeBoxRef.value
    if (!plane || !sizeBox) return

    plane.style.transform = `scale(${nextZoom})`
    sizeBox.style.width = `${baseWidth * nextZoom}px`
    sizeBox.style.height = `${baseHeight * nextZoom}px`
  }

  const measure = () => {
    const plane = planeRef.value
    if (!plane) return

    const nextWidth = plane.offsetWidth
    const nextHeight = plane.offsetHeight

    if (nextWidth <= 0 || nextHeight <= 0) return

    baseWidth = nextWidth
    baseHeight = nextHeight
    applyZoom(zoom.value)
  }

  const onMouseMove = (event: MouseEvent) => {
    const board = boardRef.value
    if (!board) return

    const dx = event.clientX - startClientX
    const dy = event.clientY - startClientY

    if (!dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return

    if (!dragged) {
      dragged = true
      isPanning.value = true
    }

    board.scrollLeft = startScrollLeft - dx
    board.scrollTop = startScrollTop - dy
  }

  const onMouseUp = () => {
    suppressNextClick = dragged
    dragged = false
    isPanning.value = false

    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  const onMouseDown = (event: MouseEvent) => {
    if (event.button === 1) {
      event.preventDefault()
      return
    }

    if (event.button !== 0) return

    // Касание браузер повторяет как события мыши: они не должны двигать доску.
    if (Date.now() < ignoreMouseUntil) return

    const board = boardRef.value
    if (!board) return

    startClientX = event.clientX
    startClientY = event.clientY
    startScrollLeft = board.scrollLeft
    startScrollTop = board.scrollTop
    dragged = false
    suppressNextClick = false

    event.preventDefault()

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const onClickCapture = (event: MouseEvent) => {
    if (!suppressNextClick) return

    suppressNextClick = false
    event.preventDefault()
    event.stopPropagation()
  }

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()

    const board = boardRef.value
    if (!board) return

    const rect = board.getBoundingClientRect()
    const cursorX = event.clientX - rect.left
    const cursorY = event.clientY - rect.top

    const rawDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
    const newZoom = zoom.value * Math.exp(-rawDelta * 0.001)

    setZoom(newZoom, cursorX, cursorY)
  }

  const setZoom = (
    nextZoom: number,
    anchorClientX?: number,
    anchorClientY?: number
  ) => {
    const board = boardRef.value
    if (!board) return

    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom))
    if (clamped === zoom.value) return

    const rect = board.getBoundingClientRect()
    const anchorX = anchorClientX ?? rect.width / 2
    const anchorY = anchorClientY ?? rect.height / 2
    const prevZoom = zoom.value

    zoom.value = clamped
    canReset.value = clamped !== 1
    applyZoom(clamped)
    options.onZoomChange?.(clamped)

    board.scrollLeft =
      ((board.scrollLeft + anchorX) / prevZoom) * clamped - anchorX
    board.scrollTop =
      ((board.scrollTop + anchorY) / prevZoom) * clamped - anchorY
  }

  /** Приближает доску на шаг. */
  const zoomIn = () => {
    setZoom(zoom.value + ZOOM_STEP)
  }

  /** Отдаляет доску на шаг. */
  const zoomOut = () => {
    setZoom(zoom.value - ZOOM_STEP)
  }

  const resetZoom = () => {
    setZoom(1)
  }

  const getZoom = () => zoom.value

  const onDragStart = (event: DragEvent) => {
    event.preventDefault()
  }

  /** Середина и расстояние между касаниями. */
  const measureTouches = (touches: TouchList) => {
    const first = touches[0]
    const second = touches[1]
    if (!first) return { midX: 0, midY: 0, distance: 0 }

    const midX = second ? (first.clientX + second.clientX) / 2 : first.clientX
    const midY = second ? (first.clientY + second.clientY) / 2 : first.clientY
    const distance = second
      ? Math.hypot(
          first.clientX - second.clientX,
          first.clientY - second.clientY
        )
      : 0

    return { midX, midY, distance }
  }

  /** Запоминает состояние доски в момент начала щипка. */
  const startPinch = (touches: TouchList) => {
    const board = boardRef.value
    if (!board) return

    const { midX, midY, distance } = measureTouches(touches)
    pinchStartDistance = distance
    pinchStartZoom = zoom.value
    pinchStartMidX = midX
    pinchStartMidY = midY
    pinchStartScrollLeft = board.scrollLeft
    pinchStartScrollTop = board.scrollTop
    isPinching = true
    // После щипка клик по клетке не должен выбирать её.
    dragged = true
    isPanning.value = false
    suppressNextClick = true
  }

  /**
   * Масштаб двумя пальцами.
   *
   * Точка, которая была под пальцами в начале щипка, остаётся на месте: её
   * координаты считаются в системе плоскости, до масштабирования.
   */
  const applyPinch = (touches: TouchList) => {
    const board = boardRef.value
    if (!board) return

    const rect = board.getBoundingClientRect()
    const { midX, midY, distance } = measureTouches(touches)
    const ratio = pinchStartDistance > 0 ? distance / pinchStartDistance : 1
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, pinchStartZoom * ratio)
    )

    const startAnchorX = pinchStartMidX - rect.left
    const startAnchorY = pinchStartMidY - rect.top
    const contentX = (pinchStartScrollLeft + startAnchorX) / pinchStartZoom
    const contentY = (pinchStartScrollTop + startAnchorY) / pinchStartZoom

    if (nextZoom !== zoom.value) {
      zoom.value = nextZoom
      canReset.value = nextZoom !== 1
      applyZoom(nextZoom)
      options.onZoomChange?.(nextZoom)
    }

    board.scrollLeft = contentX * nextZoom - (midX - rect.left)
    board.scrollTop = contentY * nextZoom - (midY - rect.top)
  }

  const onTouchStart = (event: TouchEvent) => {
    const board = boardRef.value
    if (!board) return

    ignoreMouseUntil = Date.now() + TOUCH_TO_MOUSE_GUARD_MS

    if (event.touches.length >= 2) {
      startPinch(event.touches)
      return
    }

    const touch = event.touches[0]
    if (!touch) return

    startClientX = touch.clientX
    startClientY = touch.clientY
    startScrollLeft = board.scrollLeft
    startScrollTop = board.scrollTop
    dragged = false
    suppressNextClick = false
    isPinching = false
  }

  const onTouchMove = (event: TouchEvent) => {
    const board = boardRef.value
    if (!board) return

    if (event.touches.length >= 2) {
      if (!isPinching) startPinch(event.touches)
      applyPinch(event.touches)
      event.preventDefault()
      return
    }

    const touch = event.touches[0]
    if (!touch || isPinching) return

    const dx = touch.clientX - startClientX
    const dy = touch.clientY - startClientY

    if (!dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return

    if (!dragged) {
      dragged = true
      isPanning.value = true
    }

    board.scrollLeft = startScrollLeft - dx
    board.scrollTop = startScrollTop - dy
    event.preventDefault()
  }

  const onTouchEnd = (event: TouchEvent) => {
    ignoreMouseUntil = Date.now() + TOUCH_TO_MOUSE_GUARD_MS

    if (event.touches.length > 0) return

    if (dragged) suppressNextClick = true
    dragged = false
    isPanning.value = false
    isPinching = false
  }

  onMounted(() => {
    boardRef.value?.addEventListener('wheel', onWheel, { passive: false })
    boardRef.value?.addEventListener('dragstart', onDragStart)
    boardRef.value?.addEventListener('touchstart', onTouchStart, {
      passive: false,
    })
    boardRef.value?.addEventListener('touchmove', onTouchMove, {
      passive: false,
    })
    boardRef.value?.addEventListener('touchend', onTouchEnd)
    boardRef.value?.addEventListener('touchcancel', onTouchEnd)

    if (planeRef.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(measure)
      resizeObserver.observe(planeRef.value)
    } else {
      measure()
    }
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    resizeObserver = null

    boardRef.value?.removeEventListener('wheel', onWheel)
    boardRef.value?.removeEventListener('dragstart', onDragStart)
    boardRef.value?.removeEventListener('touchstart', onTouchStart)
    boardRef.value?.removeEventListener('touchmove', onTouchMove)
    boardRef.value?.removeEventListener('touchend', onTouchEnd)
    boardRef.value?.removeEventListener('touchcancel', onTouchEnd)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  })

  return {
    boardRef,
    planeRef,
    sizeBoxRef,
    isPanning,
    canReset,
    zoom,
    zoomIn,
    zoomOut,
    getZoom,
    resetZoom,
    onMouseDown,
    onClickCapture,
  }
}
