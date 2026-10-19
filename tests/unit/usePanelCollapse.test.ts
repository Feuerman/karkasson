// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import type { App } from 'vue'
import {
  NARROW_SCREEN_WIDTH,
  usePanelCollapse,
  type PanelCollapseOptions,
} from '@/composables/usePanelCollapse'
import { resetPanelLayout } from '@/modules/panelLayout'
import { readPanelLayout } from '@/utils/panelLayout'

type Collapse = ReturnType<typeof usePanelCollapse>

let app: App | null = null

/** Ширина окна: сворачивание зависит от неё. */
const setWindowWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  })
}

const mountCollapse = (
  panelId: string,
  options: PanelCollapseOptions = {}
): Collapse => {
  let state: Collapse | undefined
  const Component = defineComponent({
    setup() {
      state = usePanelCollapse(panelId, options)
      return () => h('div')
    },
  })

  const host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(Component)
  app.mount(host)
  if (!state) throw new Error('Composable was not initialised')
  return state
}

beforeEach(() => {
  localStorage.clear()
  setWindowWidth(1200)
})

afterEach(() => {
  app?.unmount()
  app = null
})

describe('Сворачивание окна', () => {
  it('на широком экране окно развёрнуто', () => {
    const { collapsed } = mountCollapse('player-stats')

    expect(collapsed.value).toBe(false)
  })

  it('на узком экране окно сворачивается само', () => {
    setWindowWidth(NARROW_SCREEN_WIDTH - 100)

    const { collapsed } = mountCollapse('player-stats', {
      autoCollapseOnNarrow: true,
    })

    expect(collapsed.value).toBe(true)
  })

  it('окно действий на узком экране остаётся развёрнутым', () => {
    setWindowWidth(NARROW_SCREEN_WIDTH - 100)

    const { collapsed } = mountCollapse('placing-followers')

    expect(collapsed.value).toBe(false)
  })

  it('возвращает сохранённое состояние', () => {
    localStorage.setItem(
      'panelLayout',
      JSON.stringify({ collapsed: { 'player-stats': true } })
    )

    const { collapsed } = mountCollapse('player-stats')

    expect(collapsed.value).toBe(true)
  })

  it('запоминает свёрнутое состояние', async () => {
    const { collapsed, toggle } = mountCollapse('player-stats')

    toggle()
    await nextTick()

    expect(collapsed.value).toBe(true)
    expect(readPanelLayout().collapsed['player-stats']).toBe(true)
  })

  it('после сброса раскладки окно разворачивается', async () => {
    const { collapsed, toggle } = mountCollapse('player-stats')
    toggle()
    await nextTick()

    resetPanelLayout()
    await nextTick()

    expect(collapsed.value).toBe(false)
    expect(readPanelLayout().collapsed['player-stats']).toBeUndefined()
  })

  it('автоматическое сворачивание не запоминается', async () => {
    setWindowWidth(NARROW_SCREEN_WIDTH - 100)

    const { collapsed } = mountCollapse('player-stats', {
      autoCollapseOnNarrow: true,
    })
    await nextTick()

    expect(collapsed.value).toBe(true)
    expect(readPanelLayout().collapsed['player-stats']).toBeUndefined()
  })

  it('выбор игрока важнее узкого экрана', async () => {
    setWindowWidth(NARROW_SCREEN_WIDTH - 100)
    localStorage.setItem(
      'panelLayout',
      JSON.stringify({ collapsed: { 'player-stats': false } })
    )

    const { collapsed } = mountCollapse('player-stats', {
      autoCollapseOnNarrow: true,
    })
    await nextTick()

    expect(collapsed.value).toBe(false)
  })
})
