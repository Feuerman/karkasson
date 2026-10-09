<template>
  <div
    :class="
      group.isFinalScoring
        ? 'mt-2 rounded-lg bg-gold/8 p-1 ring-1 ring-gold-dark/25'
        : undefined
    "
    :data-testid="
      group.isFinalScoring ? TEST_IDS.historyFinalScoringGroup : undefined
    "
  >
    <h3
      v-if="group.isFinalScoring"
      class="title-medieval mb-1.5 flex items-center gap-1.5 px-1 text-[.8rem] leading-none text-gold-dark"
    >
      <UIcon name="i-lucide-flag" class="h-3.5 w-3.5" />
      Финальный подсчёт
    </h3>
    <h3
      v-else-if="group.moveNumber !== null"
      :data-testid="TEST_IDS.historyMoveHeader"
      class="title-medieval mb-1.5 flex items-center gap-1.5 border-b border-gold-dark/20 px-1 pb-1 text-[.8rem] leading-none text-text-muted"
    >
      <UIcon name="i-lucide-hash" class="h-3.5 w-3.5 text-gold-dark" />
      Ход {{ group.moveNumber }}
    </h3>
    <div
      v-for="(action, index) in group.actions"
      :key="`${group.moveNumber ?? 'final'}-${index}`"
    >
      <PlaceTileAction
        v-if="action.actionType === ActionTypes.PLACE_TILE"
        :action="action"
        @zoom="forwardZoom"
      />
      <PlaceFollowerAction
        v-else-if="action.actionType === ActionTypes.PLACE_FOLLOWER"
        :action="action"
        @zoom="forwardZoom"
        @focus="forwardFocus"
      />
      <AddingScoresAction
        v-else-if="action.actionType === ActionTypes.ADDING_SCORES"
        :action="action"
        :players="players"
        @focus="forwardFocus"
      />
      <BackFollowerAction
        v-else-if="action.actionType === ActionTypes.BACK_FOLLOWER"
        :action="action"
        :players="players"
      />
      <DragonMoveAction
        v-else-if="action.actionType === ActionTypes.DRAGON_MOVE"
        :action="action"
        :players="players"
        @zoom="forwardZoom"
      />
      <PrincessTakeFollowerAction
        v-else-if="action.actionType === ActionTypes.PRINCESS_TAKE_FOLLOWER"
        :action="action"
        :players="players"
        @zoom="forwardZoom"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'
import { ActionTypes } from '@server/modules/types'
import type { Player } from '@server/modules/types'
import type { TileCoordinates } from '@/utils/board'
import { TEST_IDS } from '@/data/testIds'
import type { HistoryGroup } from './historyGroups'
import PlaceTileAction from './actions/PlaceTileAction.vue'
import PlaceFollowerAction from './actions/PlaceFollowerAction.vue'
import AddingScoresAction from './actions/AddingScoresAction.vue'
import BackFollowerAction from './actions/BackFollowerAction.vue'
import DragonMoveAction from './actions/DragonMoveAction.vue'
import PrincessTakeFollowerAction from './actions/PrincessTakeFollowerAction.vue'

defineProps<{
  group: HistoryGroup
  players: Player[]
}>()

const emit = defineEmits<{
  focus: [cells: TileCoordinates[]]
  zoom: [rowIndex: number, tileIndex: number]
}>()

const forwardZoom = (rowIndex: number, tileIndex: number) => {
  emit('zoom', rowIndex, tileIndex)
}

const forwardFocus = (cells: TileCoordinates[]) => {
  emit('focus', cells)
}
</script>
