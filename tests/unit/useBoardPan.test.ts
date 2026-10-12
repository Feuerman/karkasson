// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import type { App } from 'vue'
import { useBoardPan } from '@/composables/useBoardPan'

/**
 * Масштаб и панорамирование доски — единственный клиентский код, который
 * держит состояние между событиями: зум меняет прокрутку вокруг курсора, а
 * перетаскивание подавляет следующий клик. Проверяется на настоящем DOM с
 * подставленными размерами, потому что happy-dom их не измеряет.
 */

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const BOARD_WIDTH = 400
const BOARD_HEIGHT = 300
const PLANE_WIDTH = 800
const PLANE_HEIGHT = 600

type Pan = ReturnType<typeof useBoardPan>

interface MountedPan {
  pan: Pan
  board: HTMLElement
  plane: HTMLElement
  sizeBox: HTMLElement
}

let app: App | null = null

/**
 * Размеры и прокрутка задаются обычными свойствами: happy-dom не измеряет
 * раскладку и не хранит scrollLeft на неразмеченных элементах.
 */
function stubLayout(element: HTMLElement, width: number, height: number): void {
  Object.defineProperty(element, 'offsetWidth', {
    configurable: true,
    value: width,
  })
  Object.defineProperty(element, 'offsetHeight', {
    configurable: true,
    value: height,
  })
  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    writable: true,
    value: 0,
  })
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    writable: true,
    value: 0,
  })
  element.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    }) as DOMRect
}

function mountPan(options: Parameters<typeof useBoardPan>[0] = {}): MountedPan {
  const board = document.createElement('div')
  const plane = document.createElement('div')
  const sizeBox = document.createElement('div')
  stubLayout(board, BOARD_WIDTH, BOARD_HEIGHT)
  stubLayout(plane, PLANE_WIDTH, PLANE_HEIGHT)
  stubLayout(sizeBox, 0, 0)

  let pan: Pan | undefined
  const Component = defineComponent({
    setup() {
      pan = useBoardPan(options)
      // Композабл работает только через ref'ы, поэтому сами элементы
      // достаточно создать и измерить — монтировать их в дерево не нужно
      pan.boardRef.value = board
      pan.planeRef.value = plane
      pan.sizeBoxRef.value = sizeBox
      return () => h('div')
    },
  })

  const host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(Component)
  app.mount(host)
  if (!pan) throw new Error('Composable was not initialised')
  return { pan, board, plane, sizeBox }
}

function mouseEvent(type: string, init: MouseEventInit): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
}

function wheelEvent(init: WheelEventInit): WheelEvent {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true })
  // happy-dom не читает clientX/clientY из WheelEventInit, задаём явно
  Object.defineProperty(event, 'clientX', { value: init.clientX ?? 0 })
  Object.defineProperty(event, 'clientY', { value: init.clientY ?? 0 })
  Object.defineProperty(event, 'deltaY', { value: init.deltaY ?? 0 })
  Object.defineProperty(event, 'deltaMode', { value: init.deltaMode ?? 0 })
  return event
}

/**
 * ResizeObserver в happy-dom есть, но не срабатывает без раскладки, поэтому
 * заменяем его наблюдателем, который можно вызвать вручную: так проверяется
 * настоящий путь монтирования, а измерение плоскости инициируется явно.
 */
let triggerResize: (() => void) | null = null

class FakeResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {
    triggerResize = () => this.callback([], this)
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

/** mousedown вешает потребитель на шаблоне, поэтому вызываем обработчик напрямую */
function grab(
  pan: Pan,
  clientX: number,
  clientY: number,
  button = 0
): MouseEvent {
  const event = mouseEvent('mousedown', { button, clientX, clientY })
  pan.onMouseDown(event)
  return event
}

function move(clientX: number, clientY: number): void {
  document.dispatchEvent(mouseEvent('mousemove', { clientX, clientY }))
}

function release(): void {
  document.dispatchEvent(mouseEvent('mouseup', {}))
}

/** Полное перетаскивание: нажатие, движение, отпускание */
function drag(pan: Pan, from: number, to: number, button = 0): MouseEvent {
  const press = grab(pan, from, from, button)
  move(to, to)
  release()
  return press
}

beforeEach(() => {
  document.body.innerHTML = ''
  triggerResize = null
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

afterEach(() => {
  app?.unmount()
  app = null
  vi.unstubAllGlobals()
})

describe('Масштаб доски', () => {
  it('измеряет плоскость по ResizeObserver и пересчитывает рамку при зуме', () => {
    const { pan, board, plane, sizeBox } = mountPan()

    triggerResize?.()

    board.dispatchEvent(wheelEvent({ deltaY: -100, clientX: 0, clientY: 0 }))

    const zoom = pan.getZoom()
    expect(zoom).toBeGreaterThan(1)
    expect(plane.style.transform).toBe(`scale(${zoom})`)
    expect(parseFloat(sizeBox.style.width)).toBeCloseTo(PLANE_WIDTH * zoom, 3)
    expect(parseFloat(sizeBox.style.height)).toBeCloseTo(PLANE_HEIGHT * zoom, 3)
  })

  it('не опускает зум ниже минимума и не поднимает выше максимума', () => {
    const { pan, board } = mountPan()

    for (let step = 0; step < 40; step += 1) {
      board.dispatchEvent(wheelEvent({ deltaY: 500, clientX: 0, clientY: 0 }))
    }
    expect(pan.getZoom()).toBe(MIN_ZOOM)

    for (let step = 0; step < 80; step += 1) {
      board.dispatchEvent(wheelEvent({ deltaY: -500, clientX: 0, clientY: 0 }))
    }
    expect(pan.getZoom()).toBe(MAX_ZOOM)
  })

  it('учитывает прокрутку по строкам: одна строка равна 16 пикселям', () => {
    const { pan, board } = mountPan()

    board.dispatchEvent(wheelEvent({ deltaY: -10, deltaMode: 1 }))
    const fromLines = pan.getZoom()

    pan.resetZoom()
    board.dispatchEvent(wheelEvent({ deltaY: -160, deltaMode: 0 }))
    const fromPixels = pan.getZoom()

    expect(fromLines).toBeCloseTo(fromPixels, 5)
  })

  it('не отпускает событие колеса на доске', () => {
    const { board } = mountPan()

    const event = wheelEvent({ deltaY: -100, clientX: 0, clientY: 0 })
    board.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('удерживает точку под курсором на месте при зуме', () => {
    const { pan, board } = mountPan()
    board.scrollLeft = 100
    board.scrollTop = 50
    const anchorX = 120
    const anchorY = 90

    board.dispatchEvent(
      wheelEvent({ deltaY: -300, clientX: anchorX, clientY: anchorY })
    )
    const zoom = pan.getZoom()

    expect(board.scrollLeft).toBeCloseTo((100 + anchorX) * zoom - anchorX, 5)
    expect(board.scrollTop).toBeCloseTo((50 + anchorY) * zoom - anchorY, 5)
  })

  it('предлагает сброс только когда зум отличается от единицы', () => {
    const { pan, board } = mountPan()

    expect(pan.canReset.value).toBe(false)

    board.dispatchEvent(wheelEvent({ deltaY: -100, clientX: 0, clientY: 0 }))
    expect(pan.canReset.value).toBe(true)

    pan.resetZoom()
    expect(pan.canReset.value).toBe(false)
    expect(pan.getZoom()).toBe(1)
  })

  it('сообщает о зуме через onZoomChange', () => {
    const onZoomChange = vi.fn()
    const { pan, board } = mountPan({ onZoomChange })

    board.dispatchEvent(wheelEvent({ deltaY: -100, clientX: 0, clientY: 0 }))
    pan.resetZoom()

    expect(onZoomChange).toHaveBeenCalledTimes(2)
    expect(onZoomChange.mock.calls[0]?.[0]).toBeGreaterThan(1)
    expect(onZoomChange).toHaveBeenLastCalledWith(1)
  })

  it('не сообщает о зуме, если он не изменился', () => {
    const onZoomChange = vi.fn()
    const { board } = mountPan({ onZoomChange })

    board.dispatchEvent(wheelEvent({ deltaY: 0, clientX: 0, clientY: 0 }))

    expect(onZoomChange).not.toHaveBeenCalled()
  })

  it('запрещает перетаскивание картинок на доске', () => {
    const { board } = mountPan()

    const event = new Event('dragstart', { bubbles: true, cancelable: true })
    board.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })
})

describe('Панорамирование доски', () => {
  it('не двигает доску при перемещении меньше порога', () => {
    const { pan, board } = mountPan()
    board.scrollLeft = 100

    grab(pan, 100, 100)
    move(102, 102)
    release()

    expect(board.scrollLeft).toBe(100)
    expect(pan.isPanning.value).toBe(false)
  })

  it('тянет доску за курсором и отпускает', () => {
    const { pan, board } = mountPan()
    board.scrollLeft = 100
    board.scrollTop = 100

    grab(pan, 100, 100)
    move(140, 130)
    expect(pan.isPanning.value).toBe(true)
    release()

    expect(pan.isPanning.value).toBe(false)
    expect(board.scrollLeft).toBe(60)
    expect(board.scrollTop).toBe(70)
  })

  it('перестаёт слушать перемещение после отпускания', () => {
    const { pan, board } = mountPan()
    board.scrollLeft = 100

    drag(pan, 100, 200)
    const afterDrag = board.scrollLeft
    move(400, 400)

    expect(board.scrollLeft).toBe(afterDrag)
  })

  it('подавляет клик сразу после перетаскивания', () => {
    const { pan } = mountPan()
    drag(pan, 100, 200)

    const click = mouseEvent('click', { clientX: 200, clientY: 200 })
    pan.onClickCapture(click)

    expect(click.defaultPrevented).toBe(true)
  })

  it('не подавляет клик после простого нажатия', () => {
    const { pan } = mountPan()
    grab(pan, 100, 100)
    release()

    const click = mouseEvent('click', { clientX: 100, clientY: 100 })
    pan.onClickCapture(click)

    expect(click.defaultPrevented).toBe(false)
  })

  it('подавляет клик только один раз', () => {
    const { pan } = mountPan()
    drag(pan, 100, 200)

    pan.onClickCapture(mouseEvent('click', {}))
    const second = mouseEvent('click', {})
    pan.onClickCapture(second)

    expect(second.defaultPrevented).toBe(false)
  })

  it.each([1, 2])('игнорирует нажатие кнопкой %i', (button) => {
    const { pan, board } = mountPan()
    board.scrollLeft = 100

    grab(pan, 100, 100, button)
    move(400, 400)

    expect(board.scrollLeft).toBe(100)
  })

  it('отменяет выделение текста при перетаскивании доски', () => {
    const { pan } = mountPan()

    expect(grab(pan, 100, 100).defaultPrevented).toBe(true)
  })

  it('перестаёт слушать события после размонтирования', () => {
    const { pan, board } = mountPan()
    board.scrollLeft = 100

    grab(pan, 100, 100)
    app?.unmount()
    app = null
    move(400, 400)

    expect(board.scrollLeft).toBe(100)
  })
})
