<template>
  <Draggable
    v-if="gameBoard.gameIsStarted"
    draggable-id="game-controls"
    :initial-x="10"
    :initial-y="10"
  >
    <div class="panel-parchment w-[540px] max-w-[90vw] overflow-hidden shadow-card">
      <div
        class="sticky top-0 z-10 mb-2 flex items-center justify-between gap-3 border-b border-gold-dark/30 bg-surface/90 px-5 py-2.5 backdrop-blur"
      >
        <span class="flex items-center gap-2 text-text">
          <UIcon name="i-lucide-scroll-text" class="h-5 w-5 text-gold-dark" />
          <span class="title-medieval text-[1.05rem] leading-none">
            История действий
          </span>
        </span>
        <span
          class="flex items-center gap-1.5 rounded-full border border-gold-dark/40 bg-gold/15 px-3 py-1 text-sm font-semibold text-gold-dark"
        >
          <UIcon name="i-lucide-layers" class="h-4 w-4" />
          в колоде {{ gameBoard.tilesList.length }}
        </span>
      </div>
      <div class="max-h-[400px] overflow-y-auto px-4 pb-4 pt-1">
        <div v-for="(action, index) in gameBoard.actionsHistory" :key="index">
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
import UIcon from '@nuxt/ui/components/Icon.vue'
import { ActionTypes } from '@server/modules/types'
import type { BaseObject } from '@server/modules/types'
import type { IGameBoard } from '@/types/game'
import Draggable from '@/components/Draggable.vue'
import { pulseTile, scrollToTile } from '@/utils/board'
import PlaceTileAction from './internal/actions/PlaceTileAction.vue'
import PlaceFollowerAction from './internal/actions/PlaceFollowerAction.vue'
import AddingScoresAction from './internal/actions/AddingScoresAction.vue'
import BackFollowerAction from './internal/actions/BackFollowerAction.vue'

const props = defineProps<{
  gameBoard: IGameBoard
}>()

const emits = defineEmits<{
  highlightObject: [objectData: BaseObject]
}>()

const forwardHighlightObject = (objectData: BaseObject) => {
  emits('highlightObject', objectData)
}

const zoomToCoordinates = (rowIndex: number, tileIndex: number) => {
  scrollToTile(rowIndex, tileIndex)
  pulseTile(rowIndex, tileIndex)
}
</script>
