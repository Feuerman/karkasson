<template>
  <div
    v-if="gameBoard.gameIsStarted"
    class="pointer-events-none fixed inset-x-0 top-3 z-[1900] flex flex-col items-center px-3"
  >
    <section
      v-if="summaryVisible && summary"
      :key="summaryVersion"
      :data-testid="TEST_IDS.turnSummary"
      class="turn-summary-card pointer-events-auto w-full max-w-[30rem] rounded-card border border-secondary-dark/45 bg-surface/95 px-3 py-2 text-text shadow-card backdrop-blur"
      aria-live="polite"
      @mouseenter="pauseAutoHide"
      @mouseleave="resumeAutoHide"
    >
      <header class="flex items-center gap-2">
        <span
          class="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/20"
          :class="playerBackgroundColorClass(summary.color)"
        ></span>
        <span class="title-medieval min-w-0 truncate text-label leading-none">
          {{ summaryTitle }}
        </span>
        <span
          v-if="summary.turnNumber !== null"
          class="shrink-0 text-caption font-semibold text-text-muted"
        >
          ход {{ summary.turnNumber }}
        </span>
        <span
          v-if="summaryTotal > 0"
          class="ml-auto shrink-0 rounded-pill bg-success/15 px-2 py-0.5 text-caption font-bold tabular-nums text-success-dark"
        >
          +{{ summaryTotal }}
        </span>
        <button
          type="button"
          class="ml-1 cursor-pointer rounded-md p-0.5 text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
          :data-testid="TEST_IDS.turnSummaryClose"
          aria-label="Скрыть сводку хода"
          title="Скрыть"
          @click="dismiss"
        >
          <UIcon name="i-lucide-x" class="h-3.5 w-3.5" />
        </button>
      </header>

      <div
        class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-label leading-snug"
      >
        <span v-if="summary.placedTile" class="flex items-center gap-1">
          <UIcon
            name="i-lucide-layout-grid"
            class="h-3.5 w-3.5 text-secondary-dark"
          />
          Тайл <strong>{{ summary.placedTile.tile.id }}</strong>
          <button
            type="button"
            class="cursor-pointer text-primary underline underline-offset-2 hover:text-primary-dark focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
            :aria-label="`Перейти к клетке ${summary.placedTile.rowIndex + 1}, ${summary.placedTile.tileIndex + 1}`"
            title="Перейти к плитке на доске"
            @click.stop="zoomBoardToTile(summary.placedTile)"
          >
            {{ summary.placedTile.rowIndex }}·{{ summary.placedTile.tileIndex }}
          </button>
        </span>
        <span v-if="summary.follower" class="flex items-center gap-1">
          <UIcon
            name="i-lucide-person-standing"
            class="h-3.5 w-3.5 text-secondary-dark"
          />
          Подданный на {{ followerLabel(summary.follower.placeType) }}
        </span>
        <span v-if="summary.returnedFollowers" class="flex items-center gap-1">
          <UIcon
            name="i-lucide-rotate-ccw"
            class="h-3.5 w-3.5 text-secondary-dark"
          />
          Вернулось подданных: {{ summary.returnedFollowers }}
        </span>
        <span v-if="summary.dragonMoves" class="flex items-center gap-1">
          <UIcon name="i-lucide-bird" class="h-3.5 w-3.5 text-secondary-dark" />
          Дракон двигался
        </span>
        <span v-if="summary.princessTakes" class="flex items-center gap-1">
          <UIcon
            name="i-lucide-crown"
            class="h-3.5 w-3.5 text-secondary-dark"
          />
          Принцесса забрала подданного
        </span>
      </div>

      <div
        v-if="summary.scoreEvents.length"
        class="mt-1.5 flex flex-wrap gap-1.5"
      >
        <span
          v-for="(event, index) in summary.scoreEvents"
          :key="`${event.objectType}-${index}`"
          class="rounded-card bg-secondary/15 px-1.5 py-0.5 text-caption font-semibold text-tertiary"
          :title="scoreEventTitle(event)"
        >
          {{ objectLabel(event.objectType) }}: +{{ event.points }}
        </span>
      </div>

      <div
        v-if="summary.scoreChanges.length"
        class="mt-1 flex flex-wrap gap-1.5"
      >
        <span
          v-for="change in summary.scoreChanges"
          :key="String(change.playerId)"
          class="flex items-center gap-1 rounded-card bg-surface-muted px-1.5 py-0.5 text-caption font-semibold"
          :title="`${change.playerName}: +${change.points}`"
        >
          <span
            class="h-2 w-2 rounded-full ring-1 ring-black/15"
            :class="playerBackgroundColorClass(change.color)"
          ></span>
          <span :class="playerTextColorClass(change.color)">
            {{ change.isOwn ? 'Вы' : change.playerName }}
          </span>
          <span class="tabular-nums text-success-dark"
            >+{{ change.points }}</span
          >
        </span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import { ObjectTypes, TileSideType } from '@server/modules/types'
import type { IGameBoard } from '@/types/game'
import { TEST_IDS } from '@/data/testIds'
import GameService from '@/modules/GameService'
import {
  playerBackgroundColorClass,
  playerTextColorClass,
} from '@/utils/colors'
import { findOwnPlayer } from '@/utils/players'
import { OBJECT_TYPE_NAMES } from '@/utils/labels'
import type { FollowerPlaceType } from '@/utils/followerPlaces'
import { useBoardZoom } from '@/composables/useBoardZoom'
import { useGameAudio } from '@/composables/useGameAudio'
import {
  actionTurnKey,
  buildTurnSummary,
  type TurnScoreEvent,
  type TurnSummary,
} from '@/utils/turnSummary'

const props = defineProps<{
  gameBoard: IGameBoard
  soundEnabled: boolean
}>()

const SUMMARY_DURATION_MS = 8000
let hideTimer: ReturnType<typeof setTimeout> | undefined
let previousGameId: string | undefined
let previousIsMyTurn: boolean | null = null
let previousWasEnded: boolean | null = null

const summary = ref<TurnSummary | null>(null)
const summaryVisible = ref(false)
const summaryVersion = ref(0)
const processedActions = ref<number | null>(null)

const ownPlayer = computed(() =>
  findOwnPlayer(props.gameBoard.players ?? [], {
    socketId: GameService.socketId.value,
    deviceId: GameService.deviceId,
  })
)

const { zoomToTile: zoomBoardToTile } = useBoardZoom()
const { playSound } = useGameAudio({ soundEnabled: props.soundEnabled })

const summaryTitle = computed(() => {
  if (!summary.value) return ''
  if (summary.value.isFinalScoring) return 'Финальный подсчёт'
  if (summary.value.isOwn) return 'Ваш ход'
  return summary.value.playerName
})

const summaryTotal = computed(() =>
  (summary.value?.scoreChanges ?? []).reduce(
    (total, change) => total + change.points,
    0
  )
)

const objectLabel = (objectType: ObjectTypes): string =>
  OBJECT_TYPE_NAMES[objectType] ?? 'Объект'

const followerLabel = (placeType: FollowerPlaceType): string => {
  switch (placeType) {
    case ObjectTypes.GARDEN:
      return 'сад'
    case ObjectTypes.MONASTERY:
      return 'монастырь'
    case TileSideType.City:
      return 'город'
    case TileSideType.Road:
      return 'дорога'
    case TileSideType.Field:
      return 'поле'
    default:
      return 'объект'
  }
}

const scoreEventTitle = (event: TurnScoreEvent): string => {
  const lines = (event.details ?? []).map(
    (line) =>
      `${line.label}: ${line.count} × ${line.pointsPerUnit} = ${line.total}`
  )
  const parts = [...lines, ...(event.modifiers ?? [])]
  return parts.length ? parts.join('\n') : `Начислено очков: ${event.points}`
}

const clearHideTimer = () => {
  if (hideTimer !== undefined) {
    clearTimeout(hideTimer)
    hideTimer = undefined
  }
}

const scheduleHide = () => {
  clearHideTimer()
  hideTimer = setTimeout(() => {
    summaryVisible.value = false
    hideTimer = undefined
  }, SUMMARY_DURATION_MS)
}

const dismiss = () => {
  summaryVisible.value = false
  clearHideTimer()
}

const pauseAutoHide = () => {
  clearHideTimer()
}

const resumeAutoHide = () => {
  if (summaryVisible.value) scheduleHide()
}

watch(
  () =>
    [props.gameBoard.id, props.gameBoard.actionsHistory?.length ?? 0] as const,
  ([gameId, length]) => {
    const previousId = previousGameId
    previousGameId = gameId
    const processed = processedActions.value

    if (processed === null || gameId !== previousId) {
      processedActions.value = length
      summary.value = null
      summaryVisible.value = false
      clearHideTimer()
      return
    }

    if (length <= processed) {
      processedActions.value = length
      if (length === 0) {
        summary.value = null
        summaryVisible.value = false
        clearHideTimer()
      }
      return
    }

    const history = props.gameBoard.actionsHistory ?? []
    const newActions = history.slice(processed)
    processedActions.value = length

    if (props.gameBoard.gameIsEnded) {
      summaryVisible.value = false
      return
    }

    const lastAction = newActions[newActions.length - 1]
    if (!lastAction) return

    const key = actionTurnKey(lastAction)
    const turnActions = history.filter(
      (action) => actionTurnKey(action) === key
    )
    const nextSummary = buildTurnSummary(
      turnActions,
      props.gameBoard.players ?? [],
      ownPlayer.value?.id
    )
    if (!nextSummary) return

    summary.value = nextSummary
    summaryVersion.value += 1
    summaryVisible.value = true

    if (nextSummary.scoreChanges.length > 0) playSound('score')
  },
  { immediate: true }
)

watch(
  () => props.gameBoard.isMyTurn,
  (isMyTurnNow) => {
    const previous = previousIsMyTurn
    previousIsMyTurn = isMyTurnNow
    if (previous === null) return
    if (isMyTurnNow && !previous) playSound('turn')
  },
  { immediate: true }
)

watch(
  () => props.gameBoard.gameIsEnded,
  (isEnded) => {
    const previous = previousWasEnded
    previousWasEnded = isEnded
    if (isEnded) {
      summaryVisible.value = false
      clearHideTimer()
    }
    if (previous === null) return
    if (isEnded && !previous) playSound('end')
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  clearHideTimer()
})
</script>
