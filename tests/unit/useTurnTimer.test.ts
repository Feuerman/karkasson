// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, ref } from 'vue'
import type { App, ComputedRef, Ref } from 'vue'
import { useTurnTimer } from '@/composables/useTurnTimer'

/**
 * Таймер хода считает время с момента передачи хода. Проверяется на
 * поддельных часах: реальное ожидание сделало бы тест медленным и
 * ненадёжным.
 */

let app: App | null = null

interface MountedTimer {
  elapsedSeconds: ComputedRef<number>
  turnKey: Ref<string>
}

function mountTimer(): MountedTimer {
  let timer: ReturnType<typeof useTurnTimer> | undefined
  const turnKey = ref('game-1:player-1')

  const Component = defineComponent({
    setup() {
      timer = useTurnTimer(turnKey)
      return () => h('div')
    },
  })

  const host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(Component)
  app.mount(host)
  if (!timer) throw new Error('Composable was not initialised')

  return { elapsedSeconds: timer.elapsedSeconds, turnKey }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
})

afterEach(() => {
  app?.unmount()
  app = null
  vi.useRealTimers()
})

describe('Таймер хода', () => {
  it('считает секунды хода', () => {
    const { elapsedSeconds } = mountTimer()

    expect(elapsedSeconds.value).toBe(0)

    vi.advanceTimersByTime(3000)
    expect(elapsedSeconds.value).toBe(3)
  })

  it('начинает отсчёт заново при смене хода', () => {
    const { elapsedSeconds, turnKey } = mountTimer()

    vi.advanceTimersByTime(5000)
    expect(elapsedSeconds.value).toBe(5)

    turnKey.value = 'game-1:player-2'
    expect(elapsedSeconds.value).toBe(0)

    vi.advanceTimersByTime(2000)
    expect(elapsedSeconds.value).toBe(2)
  })

  it('останавливается при размонтировании', () => {
    const { elapsedSeconds } = mountTimer()

    app?.unmount()
    app = null
    vi.advanceTimersByTime(5000)

    expect(elapsedSeconds.value).toBe(0)
  })
})
