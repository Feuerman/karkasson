<template>
  <div
    :class="
      group.isFinalScoring
        ? 'mt-2 rounded-card bg-secondary/8 p-1 ring-1 ring-secondary-dark/25'
        : undefined
    "
    :data-testid="
      group.isFinalScoring ? TEST_IDS.historyFinalScoringGroup : undefined
    "
  >
    <h3
      v-if="group.isFinalScoring"
      class="title-medieval mb-1.5 flex items-center gap-1.5 px-1 text-caption leading-none text-secondary-dark"
    >
      <UIcon name="i-lucide-flag" class="h-3.5 w-3.5" />
      Финальный подсчёт
    </h3>
    <h3
      v-else-if="group.turnNumber !== null"
      :data-testid="TEST_IDS.historyMoveHeader"
      class="title-medieval mb-1.5 flex items-center gap-1.5 border-b border-secondary-dark/20 px-1 pb-1 text-caption leading-none text-text-muted"
    >
      <UIcon name="i-lucide-hash" class="h-3.5 w-3.5 text-secondary-dark" />
      Ход {{ group.turnNumber }}
      <span
        v-if="groupPlayer"
        class="ml-1 truncate"
        :class="playerTextColorClass(groupPlayer.color)"
      >
        · {{ groupPlayer.name }}
      </span>
    </h3>
    <div
      v-for="(action, index) in group.actions"
      :key="`${group.turnNumber ?? 'final'}-${index}`"
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
        @focus="forwardFocus"
      />
      <BackFollowerAction
        v-else-if="action.actionType === ActionTypes.BACK_FOLLOWER"
        :action="action"
      />
      <DragonMoveAction
        v-else-if="action.actionType === ActionTypes.DRAGON_MOVE"
        :action="action"
        @zoom="forwardZoom"
      />
      <PrincessTakeFollowerAction
        v-else-if="action.actionType === ActionTypes.PRINCESS_TAKE_FOLLOWER"
        :action="action"
        @zoom="forwardZoom"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'
import { computed } from 'vue'
import { ActionTypes } from '@server/modules/types'
import type { TileCoordinates } from '@/utils/board'
import { playerTextColorClass } from '@/utils/colors'
import { TEST_IDS } from '@/data/testIds'
import type { HistoryGroup } from './historyGroups'
import PlaceTileAction from './actions/PlaceTileAction.vue'
import PlaceFollowerAction from './actions/PlaceFollowerAction.vue'
import AddingScoresAction from './actions/AddingScoresAction.vue'
import BackFollowerAction from './actions/BackFollowerAction.vue'
import DragonMoveAction from './actions/DragonMoveAction.vue'
import PrincessTakeFollowerAction from './actions/PrincessTakeFollowerAction.vue'

const props = defineProps<{
  group: HistoryGroup
}>()

const groupPlayer = computed(
  () => props.group.actions.find((action) => action.initiator)?.initiator
)

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
