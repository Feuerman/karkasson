import { computed, ref } from 'vue'

const STORAGE_KEY = 'onboardingCompletedSteps'

export type OnboardingPhase =
  | 'place-tile'
  | 'place-follower'
  | 'move-dragon'
  | 'princess'
  | 'move-fairy'
  | 'recall-abbot'

export interface OnboardingStep {
  id: string
  phase: OnboardingPhase
  title: string
  hint: string
}

const STEPS: OnboardingStep[] = [
  {
    id: 'place-tile',
    phase: 'place-tile',
    title: 'Первый тайл',
    hint: 'Выберите свободную клетку на доске и нажмите «Разместить», чтобы выложить тайл.',
  },
  {
    id: 'place-follower',
    phase: 'place-follower',
    title: 'Подданный',
    hint: 'После тайла можно выставить подданного на город, дорогу, монастырь или сад.',
  },
  {
    id: 'move-dragon',
    phase: 'move-dragon',
    title: 'Дракон',
    hint: 'Выберите соседний тайл, куда шагнёт дракон. Каждый шаг съедает подданных на пути.',
  },
  {
    id: 'princess',
    phase: 'princess',
    title: 'Принцесса',
    hint: 'Принцесса выгоняет рыцаря из города. Выберите, чьего подданного забрать.',
  },
  {
    id: 'move-fairy',
    phase: 'move-fairy',
    title: 'Фея',
    hint: 'Вместо подданного можно передвинуть фею к своей фишке — она даст очко в конце хода.',
  },
  {
    id: 'recall-abbot',
    phase: 'recall-abbot',
    title: 'Отзыв аббата',
    hint: 'Заберите аббата с монастыря или сада и получите очки за каждый соседний тайл.',
  },
]

function readCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (
      Array.isArray(parsed) &&
      parsed.every((item): item is string => typeof item === 'string')
    ) {
      return new Set(parsed)
    }
  } catch {
    // Приватный режим или битые данные: обучение начнётся заново.
  }
  return new Set()
}

function writeCompleted(completed: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]))
  } catch {
    // Приватный режим или переполненное хранилище: прогресс проживёт до перезагрузки.
  }
}

export function useOnboarding() {
  const completed = ref<Set<string>>(readCompleted())
  const currentPhase = ref<OnboardingPhase | null>(null)

  const currentStep = computed(() => {
    if (!currentPhase.value) return null
    return (
      STEPS.find(
        (step) =>
          step.phase === currentPhase.value && !completed.value.has(step.id)
      ) ?? null
    )
  })

  const isCompleted = (id: string) => completed.value.has(id)

  const isAllCompleted = computed(() =>
    STEPS.every((step) => completed.value.has(step.id))
  )

  const setPhase = (phase: OnboardingPhase | null): void => {
    currentPhase.value = phase
  }

  const completeStep = (id: string): void => {
    completed.value.add(id)
    writeCompleted(completed.value)
  }

  const skipStep = (id: string): void => {
    completed.value.add(id)
    writeCompleted(completed.value)
  }

  return {
    currentPhase,
    currentStep,
    isCompleted,
    isAllCompleted,
    setPhase,
    completeStep,
    skipStep,
    steps: STEPS,
  }
}
