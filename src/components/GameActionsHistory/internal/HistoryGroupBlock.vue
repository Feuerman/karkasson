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
      class="title-medieval mb-1 flex items-center gap-1.5 px-1 text-[.68rem] leading-none text-gold-dark"
    >
      <UIcon name="i-lucide-flag" class="h-3 w-3" />
      Финальный подсчёт
    </h3>
    <h3
      v-else-if="group.moveNumber !== null"
      :data-testid="TEST_IDS.historyMoveHeader"
      class="title-medieval mb-1 flex items-center gap-1.5 border-b border-gold-dark/20 px-1 pb-0.5 text-[.68rem] leading-none text-text-muted"
    >
      <UIcon name="i-lucide-hash" class="h-3 w-3 text-gold-dark" />
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
      />
      <AddingScoresAction
        v-else-if="action.actionType === ActionTypes.ADDING_SCORES"
        :action="action"
        :players="players"
        @highlight-object="emit('highlightObject', $event)"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'
import { ActionTypes } from '@server/modules/types'
import type { BaseObject, Player } from '@server/modules/types'
import { TEST_IDS } from '@/data/testIds'
import type { HistoryGroup } from './historyGroups'
import PlaceTileAction from './actions/PlaceTileAction.vue'
import PlaceFollowerAction from './actions/PlaceFollowerAction.vue'
import AddingScoresAction from './actions/AddingScoresAction.vue'
import BackFollowerAction from './actions/BackFollowerAction.vue'
import DragonMoveAction from './actions/DragonMoveAction.vue'

defineProps<{
  group: HistoryGroup
  players: Player[]
}>()

const emit = defineEmits<{
  highlightObject: [objectData: BaseObject]
  zoom: [rowIndex: number, tileIndex: number]
}>()

const forwardZoom = (rowIndex: number, tileIndex: number) => {
  emit('zoom', rowIndex, tileIndex)
}
</script>
