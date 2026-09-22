import { onBeforeUnmount, onMounted, ref } from 'vue'

const DRAG_THRESHOLD_PX = 5
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3

export interface BoardPanOptions {
  onZoomChange?: (zoom: number) => void
}

export const useBoardPan = (options: BoardPanOptions = {}) => {
  const boardRef = ref<HTMLElement | null>(null)
  const planeRef = ref<HTMLElement | null>(null)
  const sizeBoxRef = ref<HTMLElement | null>(null)
  const isPanning = ref(false)
  const canReset = ref(false)

  let zoom = 1
  let baseWidth = 0
  let baseHeight = 0
  let resizeObserver: ResizeObserver | null = null

  let startClientX = 0
  let startClientY = 0
  let startScrollLeft = 0
  let startScrollTop = 0
  let dragged = false
  let suppressNextClick = false

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
    applyZoom(zoom)
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
    const newZoom = zoom * Math.exp(-rawDelta * 0.001)

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
    if (clamped === zoom) return

    const rect = board.getBoundingClientRect()
    const anchorX = anchorClientX ?? rect.width / 2
    const anchorY = anchorClientY ?? rect.height / 2
    const prevZoom = zoom

    zoom = clamped
    canReset.value = clamped !== 1
    applyZoom(clamped)
    options.onZoomChange?.(clamped)

    board.scrollLeft =
      ((board.scrollLeft + anchorX) / prevZoom) * clamped - anchorX
    board.scrollTop =
      ((board.scrollTop + anchorY) / prevZoom) * clamped - anchorY
  }

  const resetZoom = () => {
    setZoom(1)
  }

  const getZoom = () => zoom

  const onDragStart = (event: DragEvent) => {
    event.preventDefault()
  }

  onMounted(() => {
    boardRef.value?.addEventListener('wheel', onWheel, { passive: false })
    boardRef.value?.addEventListener('dragstart', onDragStart)

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
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  })

  return {
    boardRef,
    planeRef,
    sizeBoxRef,
    isPanning,
    canReset,
    getZoom,
    resetZoom,
    onMouseDown,
    onClickCapture,
  }
}
