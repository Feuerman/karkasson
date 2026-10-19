import { describe, expect, it } from 'vitest'
import { formatDuration } from '@/utils/time'

/**
 * Таймер хода показывается в узкой панели партии, поэтому длительность
 * записывается коротко: «мм:сс».
 */
describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [59, '0:59'],
    [60, '1:00'],
    [65, '1:05'],
    [600, '10:00'],
    [3600, '60:00'],
  ])('для %i секунд даёт %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected)
  })

  it('отбрасывает дробные секунды', () => {
    expect(formatDuration(9.9)).toBe('0:09')
  })

  it('для отрицательного значения даёт ноль', () => {
    expect(formatDuration(-5)).toBe('0:00')
  })
})
