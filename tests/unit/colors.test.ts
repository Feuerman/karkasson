import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playerColorValue } from '@/utils/colors'

describe('playerColorValue', () => {
  const playerColors = {
    coral: '#ff7f50',
    skyblue: '#87ceeb',
    lime: '#00ff00',
    gold: '#ffd700',
    orchid: '#da70d6',
    teal: '#008080',
    salmon: '#fa8072',
    slateblue: '#6a5acd',
  } as const
  const cssColors = new Map<string, string>([
    ...Object.entries(playerColors).map(
      ([color, value]) => [`--color-player-${color}`, value] as const
    ),
    ['--color-border-strong', '#b29b6a'],
  ])

  beforeEach(() => {
    vi.stubGlobal('document', { documentElement: {} })
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (property: string) => cssColors.get(property) ?? '',
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  it.each(Object.entries(playerColors))(
    'maps %s to its canvas color',
    (playerColor, expectedColor) => {
      expect(playerColorValue(playerColor)).toBe(expectedColor)
    }
  )

  it('uses the neutral color for missing or unknown player colors', () => {
    expect(playerColorValue()).toBe('#b29b6a')
    expect(playerColorValue('unknown')).toBe('#b29b6a')
    expect(playerColorValue('CORAL')).toBe('#ff7f50')
  })
})
