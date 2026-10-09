<template>
  <Draggable
    v-if="gameBoard.gameIsStarted"
    draggable-id="game-actions-history"
    :initial-y="16"
    :right-offset="16"
    :drag-enabled="dragEnabled"
  >
    <div
      class="panel-parchment w-[330px] max-w-[90vw] overflow-hidden shadow-card"
    >
      <div
        class="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-gold-dark/30 bg-surface/90 px-3 py-2 backdrop-blur"
      >
        <span class="flex items-center gap-2 text-text">
          <UIcon name="i-lucide-scroll-text" class="h-4 w-4 text-gold-dark" />
          <span class="title-medieval text-[.95rem] leading-none">
            История ходов
          </span>
        </span>
        <div class="flex items-center gap-1.5">
          <span class="text-xl font-semibold text-text-muted">
            {{ gameBoard.moveCounter ?? 0 }}
            <span class="text-sm">ход</span>
          </span>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            :icon="
              isCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'
            "
            :aria-label="
              isCollapsed ? 'Развернуть историю' : 'Свернуть историю'
            "
            :aria-expanded="!isCollapsed"
            class="h-7 w-7 cursor-pointer justify-center p-0"
            @click="isCollapsed = !isCollapsed"
          />
        </div>
      </div>
      <div
        v-if="!isCollapsed"
        data-no-drag
        class="border-b border-gold-dark/20 bg-surface/60 px-2 py-1.5"
      >
        <div
          class="flex flex-wrap gap-1"
          role="group"
          aria-label="Фильтр истории"
        >
          <UButton
            v-for="item in HISTORY_FILTERS"
            :key="item.value"
            size="xs"
            :color="activeFilter === item.value ? 'primary' : 'neutral'"
            :variant="activeFilter === item.value ? 'solid' : 'ghost'"
            :icon="item.icon"
            :disabled="!filterCounts[item.value]"
            :data-testid="`${TEST_IDS.historyFilter}-${item.value.toLowerCase()}`"
            class="h-7 cursor-pointer gap-1.5 px-2 text-[.78rem]"
            @click="activeFilter = item.value"
          >
            {{ item.label }}
            <span class="tabular-nums opacity-70">{{
              filterCounts[item.value]
            }}</span>
          </UButton>
        </div>
      </div>
      <div
        v-if="!isCollapsed"
        ref="historyScroll"
        data-no-drag
        class="max-h-[min(62vh,560px)] overflow-y-auto px-2 pb-2 pt-1"
      >
        <p
          v-if="!visibleActions.length"
          class="px-1 py-3 text-center text-[.85rem] text-text-muted"
        >
          Нет действий этого типа
        </p>
        <HistoryGroupBlock
          v-for="(group, index) in visibleGroups"
          :key="index"
          :group="group"
          :players="gameBoard.players"
          @highlight-object="forwardHighlightObject"
          @zoom="zoomToCoordinates"
        />
      </div>
    </div>
  </Draggable>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { BaseObject } from '@server/modules/types'
import type { IGameBoard } from '@/types/game'
import { TEST_IDS } from '@/data/testIds'
import Draggable from '@/components/Draggable.vue'
import { pulseTile, scrollToTile } from '@/utils/board'
import HistoryGroupBlock from './internal/HistoryGroupBlock.vue'
import {
  countActionsByFilter,
  filterActionsHistory,
  HISTORY_FILTERS,
  HistoryFilters,
  type HistoryFilter,
} from './internal/historyFilter'
import { groupActionsHistory } from './internal/historyGroups'

const { gameBoard } = defineProps<{
  gameBoard: IGameBoard
  dragEnabled?: boolean
}>()

const emits = defineEmits<{
  highlightObject: [objectData: BaseObject]
}>()

let cancelTilePulse: (() => void) | undefined
const isCollapsed = ref(false)
const activeFilter = ref<HistoryFilter>(HistoryFilters.ALL)
const historyScroll = ref<HTMLElement | null>(null)

const actions = computed(() => gameBoard.actionsHistory ?? [])
const filterCounts = computed(() => countActionsByFilter(actions.value))
const visibleActions = computed(() =>
  filterActionsHistory(actions.value, activeFilter.value)
)
const visibleGroups = computed(() => groupActionsHistory(visibleActions.value))

watch(
  () => [actions.value.length, isCollapsed.value, activeFilter.value],
  async () => {
    if (isCollapsed.value) return
    await nextTick()
    if (historyScroll.value) {
      historyScroll.value.scrollTop = historyScroll.value.scrollHeight
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  cancelTilePulse?.()
})

const forwardHighlightObject = (objectData: BaseObject) => {
  emits('highlightObject', objectData)
}

const zoomToCoordinates = (rowIndex: number, tileIndex: number) => {
  scrollToTile(rowIndex, tileIndex)
  cancelTilePulse?.()
  cancelTilePulse = pulseTile(rowIndex, tileIndex)
}
</script>
