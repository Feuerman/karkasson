// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import type { App } from 'vue'
import { useOnboarding } from '@/composables/useOnboarding'

type Onboarding = ReturnType<typeof useOnboarding>

let app: App | null = null

const mountOnboarding = (): Onboarding => {
  let state: Onboarding | undefined
  const Component = defineComponent({
    setup() {
      state = useOnboarding()
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
})

afterEach(() => {
  app?.unmount()
  app = null
})

describe('Обучение по фазам игры', () => {
  it('все шаги имеют фазу, заголовок и подсказку на обоих языках', () => {
    const { steps } = mountOnboarding()

    expect(steps.length).toBeGreaterThan(0)
    for (const step of steps) {
      expect(step.id).toBeTruthy()
      expect(step.phase).toBeTruthy()
      expect(step.title).toBeTruthy()
      expect(step.hint).toBeTruthy()
    }
  })

  it('без фазы текущий шаг равен null', () => {
    const { currentStep } = mountOnboarding()

    expect(currentStep.value).toBeNull()
  })

  it('показывает первый непройденный шаг текущей фазы', () => {
    const { setPhase, currentStep } = mountOnboarding()

    setPhase('place-tile')
    expect(currentStep.value?.id).toBe('place-tile')
    expect(currentStep.value?.phase).toBe('place-tile')
  })

  it('после completeStep шаг считается пройденным и сохраняется', () => {
    const { setPhase, currentStep, completeStep, isCompleted } =
      mountOnboarding()

    setPhase('place-tile')
    completeStep('place-tile')

    expect(isCompleted('place-tile')).toBe(true)
    expect(currentStep.value?.id).not.toBe('place-tile')
    expect(localStorage.getItem('onboardingCompletedSteps')).toContain(
      'place-tile'
    )
  })

  it('skipStep помечает шаг как пройденный', () => {
    const { setPhase, currentStep, skipStep, isCompleted } = mountOnboarding()

    setPhase('place-tile')
    skipStep('place-tile')

    expect(isCompleted('place-tile')).toBe(true)
    expect(currentStep.value?.id).not.toBe('place-tile')
  })

  it('сохранённые шаги восстанавливаются при перезагрузке', () => {
    localStorage.setItem(
      'onboardingCompletedSteps',
      JSON.stringify(['place-tile'])
    )

    const { setPhase, currentStep, isCompleted } = mountOnboarding()

    setPhase('place-tile')
    expect(isCompleted('place-tile')).toBe(true)
    expect(currentStep.value?.id).not.toBe('place-tile')
  })

  it('битые данные в хранилище сбрасывают прогресс', () => {
    localStorage.setItem('onboardingCompletedSteps', 'not-json')

    const { isCompleted } = mountOnboarding()

    expect(isCompleted('place-tile')).toBe(false)
  })

  it('все шаги пройдены — isAllCompleted true', () => {
    localStorage.setItem(
      'onboardingCompletedSteps',
      JSON.stringify([
        'place-tile',
        'place-follower',
        'move-dragon',
        'princess',
        'move-fairy',
        'recall-abbot',
      ])
    )

    const { isAllCompleted } = mountOnboarding()

    expect(isAllCompleted.value).toBe(true)
  })
})
