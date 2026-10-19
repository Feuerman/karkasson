import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

const TICK_MS = 1000

/**
 * Мягкий таймер хода.
 *
 * Считает время с момента передачи хода. Жёсткого ограничения в игре нет,
 * поэтому таймер только показывает, сколько ход длится, и ни на что не влияет.
 *
 * `turnKey` — признак смены хода: с его изменением отсчёт начинается заново.
 */
export const useTurnTimer = (turnKey: Ref<string>) => {
  const startedAt = ref(Date.now())
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | undefined

  watch(
    turnKey,
    () => {
      startedAt.value = Date.now()
      now.value = startedAt.value
    },
    // Смена хода сбрасывает отсчёт сразу: иначе между ходами на экране
    // оставались бы секунды прошлого хода.
    { flush: 'sync' }
  )

  onMounted(() => {
    timer = setInterval(() => {
      now.value = Date.now()
    }, TICK_MS)
  })

  onBeforeUnmount(() => {
    if (timer !== undefined) clearInterval(timer)
    timer = undefined
  })

  const elapsedSeconds = computed(() =>
    Math.max(0, Math.floor((now.value - startedAt.value) / 1000))
  )

  return { elapsedSeconds }
}
