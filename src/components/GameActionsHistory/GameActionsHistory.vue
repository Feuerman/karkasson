<template>
  <Draggable
    v-if="gameBoard.gameIsStarted"
    draggable-id="game-actions-history"
    :initial-y="16"
    :right-offset="16"
    :drag-enabled="dragEnabled"
  >
    <div
      class="panel-parchment w-[300px] max-w-[90vw] overflow-hidden shadow-card"
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
        ref="historyScroll"
        data-no-drag
        class="max-h-[min(62vh,560px)] overflow-y-auto px-2 pb-2 pt-1"
      >
        <div
          v-for="(action, index) in gameBoard.actionsHistory ?? []"
          :key="index"
        >
          <PlaceTileAction
            v-if="action.actionType === ActionTypes.PLACE_TILE"
            :action="action"
            @zoom="zoomToCoordinates"
          />
          <PlaceFollowerAction
            v-else-if="action.actionType === ActionTypes.PLACE_FOLLOWER"
            :action="action"
            @zoom="zoomToCoordinates"
          />
          <AddingScoresAction
            v-else-if="action.actionType === ActionTypes.ADDING_SCORES"
            :action="action"
            :players="gameBoard.players"
            @highlight-object="forwardHighlightObject"
          />
          <BackFollowerAction
            v-else-if="action.actionType === ActionTypes.BACK_FOLLOWER"
            :action="action"
            :players="gameBoard.players"
          />
        </div>
      </div>
    </div>
  </Draggable>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ActionTypes } from '@server/modules/types'
import type { BaseObject } from '@server/modules/types'
import type { IGameBoard } from '@/types/game'
import Draggable from '@/components/Draggable.vue'
import { pulseTile, scrollToTile } from '@/utils/board'
import PlaceTileAction from './internal/actions/PlaceTileAction.vue'
import PlaceFollowerAction from './internal/actions/PlaceFollowerAction.vue'
import AddingScoresAction from './internal/actions/AddingScoresAction.vue'
import BackFollowerAction from './internal/actions/BackFollowerAction.vue'

const { gameBoard } = defineProps<{
  gameBoard: IGameBoard
  dragEnabled?: boolean
}>()

const emits = defineEmits<{
  highlightObject: [objectData: BaseObject]
}>()

let cancelTilePulse: (() => void) | undefined
const isCollapsed = ref(false)
const historyScroll = ref<HTMLElement | null>(null)

watch(
  () => [gameBoard.actionsHistory?.length ?? 0, isCollapsed.value],
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
