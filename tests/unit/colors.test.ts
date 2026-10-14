import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playerColorValue } from '@/utils/colors'

describe('playerColorValue', () => {
  const colors = {
    '--color-player-coral': '#ff7f50',
    '--color-player-skyblue': '#87ceeb',
    '--color-player-lime': '#00ff00',
    '--color-player-gold': '#ffd700',
    '--color-player-orchid': '#da70d6',
    '--color-player-teal': '#008080',
    '--color-player-salmon': '#fa8072',
    '--color-player-slateblue': '#6a5acd',
    '--color-border-strong': '#b29b6a',
  }

  beforeEach(() => {
    vi.stubGlobal('document', { documentElement: {} })
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (property: keyof typeof colors) => colors[property],
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

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
