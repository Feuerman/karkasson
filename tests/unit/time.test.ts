import { describe, expect, it } from 'vitest'
import { formatDuration, formatRelativeTime } from '@/utils/time'

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

/**
 * Давность партии в списке: игрок видит, какая комната живая, а какая
 * заброшена.
 */
describe('formatRelativeTime', () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0)
  const ago = (seconds: number) => now - seconds * 1000

  it.each([
    [0, 'только что'],
    [30, 'только что'],
    [60, '1 минуту назад'],
    [120, '2 минуты назад'],
    [300, '5 минут назад'],
    [3600, '1 час назад'],
    [7200, '2 часа назад'],
    [86_400, 'вчера'],
    [172_800, '2 дня назад'],
  ])('для %i секунд назад даёт %s', (seconds, expected) => {
    expect(formatRelativeTime(ago(seconds), now)).toBe(expected)
  })

  it('для неизвестного времени даёт пустую строку', () => {
    expect(formatRelativeTime(0, now)).toBe('')
  })

  it('для времени из будущего не даёт отрицательных значений', () => {
    expect(formatRelativeTime(now + 60_000, now)).toBe('только что')
  })
})
