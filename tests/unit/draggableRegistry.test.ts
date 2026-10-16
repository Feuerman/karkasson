import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DraggableRegistry } from '@/modules/draggableRegistry'

const SCREEN_WIDTH = 100
const SCREEN_HEIGHT = 80
const REGISTERED_IDS = ['first', 'second', 'panel', 'placed']

function bounds(x: number, y: number, width: number, height: number) {
  return { x, y, width, height }
}

beforeEach(() => {
  vi.stubGlobal('window', {
    innerWidth: SCREEN_WIDTH,
    innerHeight: SCREEN_HEIGHT,
  })
})

afterEach(() => {
  REGISTERED_IDS.forEach((id) => DraggableRegistry.unregister(id))
  vi.unstubAllGlobals()
})

describe('DraggableRegistry', () => {
  it('проверяет пересечение, не считая касание границ столкновением', () => {
    DraggableRegistry.register('first', bounds(10, 10, 20, 20))

    expect(
      DraggableRegistry.checkCollisions('second', bounds(30, 10, 10, 10))
    ).toBe(false)
    expect(
      DraggableRegistry.checkCollisions('second', bounds(29, 10, 10, 10))
    ).toBe(true)
    expect(
      DraggableRegistry.checkCollisions('first', bounds(10, 10, 20, 20))
    ).toBe(false)
  })

  it('удаляет позицию из реестра', () => {
    DraggableRegistry.register('first', bounds(0, 0, 20, 20))

    DraggableRegistry.unregister('first')

    expect(
      DraggableRegistry.checkCollisions('second', bounds(0, 0, 20, 20))
    ).toBe(false)
  })

  it('ищет первое свободное место, сдвигаясь по горизонтали', () => {
    DraggableRegistry.register('first', bounds(0, 0, 20, 20))

    expect(DraggableRegistry.findFreePosition('second', 0, 0, 20, 20)).toEqual({
      x: 20,
      y: 0,
    })
  })

  it('переносит поиск на следующую строку у края экрана', () => {
    DraggableRegistry.register('first', bounds(90, 0, 20, 20))
    DraggableRegistry.register('second', bounds(0, 10, 15, 20))

    expect(DraggableRegistry.findFreePosition('placed', 90, 0, 20, 20)).toEqual(
      { x: 20, y: 10 }
    )
  })

  it('ограничивает панель экраном, ищет свободное место и регистрирует её', () => {
    DraggableRegistry.register('first', bounds(0, 0, 40, 40))

    expect(
      DraggableRegistry.placeCollisionFree('placed', -10, -10, 20, 20)
    ).toEqual({ x: 40, y: 0, width: 20, height: 20 })
    expect(
      DraggableRegistry.checkCollisions('second', bounds(40, 0, 20, 20))
    ).toBe(true)
  })

  it('размещает панель у нижнего правого края в пределах экрана', () => {
    expect(
      DraggableRegistry.placeCollisionFree('placed', 95, 75, 20, 20)
    ).toEqual({ x: 80, y: 60, width: 20, height: 20 })
  })
})
