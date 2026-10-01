import { describe, expect, it } from 'vitest'
import { playerColorValue } from '@/utils/colors'

describe('playerColorValue', () => {
  it.each([
    ['coral', '#ff7f50'],
    ['skyblue', '#87ceeb'],
    ['lime', '#00ff00'],
    ['gold', '#ffd700'],
    ['orchid', '#da70d6'],
    ['teal', '#008080'],
    ['salmon', '#fa8072'],
    ['slateblue', '#6a5acd'],
  ])('maps %s to its canvas color', (playerColor, expectedColor) => {
    expect(playerColorValue(playerColor)).toBe(expectedColor)
  })

  it('uses the neutral color for missing or unknown player colors', () => {
    expect(playerColorValue()).toBe('#b29b6a')
    expect(playerColorValue('unknown')).toBe('#b29b6a')
    expect(playerColorValue('CORAL')).toBe('#ff7f50')
  })
})
