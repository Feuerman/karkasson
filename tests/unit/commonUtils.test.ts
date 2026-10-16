import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clamp, pluralForm, throttle } from '@/utils/common'

/**
 * `pluralForm` разбирает числа для подписей вида «3 очка», поэтому проверяется
 * таблицей: подвохи русского склонения живут в числах 11-14 и 111-114.
 */

const ONE = 'очко'
const TWO = 'очка'
const FIVE = 'очков'

describe('pluralForm', () => {
  it.each([
    [1, ONE],
    [21, ONE],
    [2, TWO],
    [4, TWO],
    [22, TWO],
    [102, TWO],
    [0, FIVE],
    [5, FIVE],
    [10, FIVE],
    [11, FIVE],
    [14, FIVE],
    [15, FIVE],
    [20, FIVE],
    [25, FIVE],
    [100, FIVE],
    [111, FIVE],
    [114, FIVE],
  ])('для числа %i выбирает «%s»', (count, expected) => {
    expect(pluralForm(count, ONE, TWO, FIVE)).toBe(expected)
  })
})

describe('clamp', () => {
  it.each([
    [5, 0, 3, 3],
    [-1, 0, 3, 0],
    [2, 0, 3, 2],
    [0, 0, 3, 0],
    [3, 0, 3, 3],
  ])('clamp(%i, %i, %i) = %i', (value, min, max, expected) => {
    expect(clamp(value, min, max)).toBe(expected)
  })
})

describe('throttle', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('вызывает функцию один раз после паузы, а не на каждый вызов', () => {
    const spy = vi.fn()
    const throttled = throttle(spy, 100)

    throttled()
    throttled()
    throttled()

    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('после паузы снова принимает вызов', () => {
    const spy = vi.fn()
    const throttled = throttle(spy, 100)

    throttled()
    vi.advanceTimersByTime(100)
    throttled()
    vi.advanceTimersByTime(100)

    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('cancel отменяет отложенный вызов', () => {
    const spy = vi.fn()
    const throttled = throttle(spy, 100)

    throttled()
    throttled.cancel()
    vi.advanceTimersByTime(100)

    expect(spy).not.toHaveBeenCalled()
  })

  it('после отмены следующий вызов снова планируется', () => {
    const spy = vi.fn()
    const throttled = throttle(spy, 100)

    throttled()
    throttled.cancel()
    throttled()
    vi.advanceTimersByTime(100)

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
