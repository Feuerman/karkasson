// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  PANEL_LAYOUT_STORAGE_KEY,
  clearPanelLayout,
  readPanelLayout,
  writePanelCollapsed,
  writePanelPosition,
} from '@/utils/panelLayout'

beforeEach(() => {
  localStorage.clear()
})

describe('Раскладка окон', () => {
  it('пустая, если ничего не сохраняли', () => {
    expect(readPanelLayout()).toEqual({ positions: {}, collapsed: {} })
  })

  it('хранит место окна', () => {
    writePanelPosition('player-stats', { x: 120, y: 40 })

    expect(readPanelLayout().positions['player-stats']).toEqual({
      x: 120,
      y: 40,
    })
  })

  it('не затирает места других окон', () => {
    writePanelPosition('player-stats', { x: 120, y: 40 })
    writePanelPosition('game-actions-history', { x: 10, y: 20 })

    const { positions } = readPanelLayout()
    expect(positions['player-stats']).toEqual({ x: 120, y: 40 })
    expect(positions['game-actions-history']).toEqual({ x: 10, y: 20 })
  })

  it('хранит признак свёрнутости окна', () => {
    writePanelCollapsed('game-actions-history', true)

    expect(readPanelLayout().collapsed['game-actions-history']).toBe(true)
  })

  it('игнорирует повреждённые данные', () => {
    localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, '{ это не json')
    expect(readPanelLayout()).toEqual({ positions: {}, collapsed: {} })

    localStorage.setItem(
      PANEL_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        positions: { 'player-stats': { x: 'лево', y: 40 }, ok: { x: 1, y: 2 } },
        collapsed: { 'player-stats': 'да', ok: true },
      })
    )

    const layout = readPanelLayout()
    expect(layout.positions['player-stats']).toBeUndefined()
    expect(layout.positions['ok']).toEqual({ x: 1, y: 2 })
    expect(layout.collapsed['player-stats']).toBeUndefined()
    expect(layout.collapsed['ok']).toBe(true)
  })

  it('убирает раскладку целиком', () => {
    writePanelPosition('player-stats', { x: 120, y: 40 })
    writePanelCollapsed('player-stats', true)

    clearPanelLayout()

    expect(readPanelLayout()).toEqual({ positions: {}, collapsed: {} })
  })

  it('работает без хранилища', () => {
    expect(readPanelLayout(null)).toEqual({ positions: {}, collapsed: {} })
    expect(() =>
      writePanelPosition('player-stats', { x: 1, y: 2 }, null)
    ).not.toThrow()
    expect(() => clearPanelLayout(null)).not.toThrow()
  })
})
