<template>
  <ActionRow icon="i-lucide-person-standing">
    <strong class="mr-[3px] text-text">
      Выставлен
      {{ action.actionData.followerType === 'abbot' ? 'аббат' : 'подданный' }}.
    </strong>
    <PlayerName :color="action.initiator?.color">
      {{ action.initiator?.name }}.
    </PlayerName>
    <span class="text-text">
      На клетку
      <ActionCoordinates
        :row="action.actionData.point.y"
        :col="action.actionData.point.x"
        @zoom="forwardZoom"
      />
      на объект {{ objectName }}
    </span>
  </ActionRow>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ActionTypes } from '@server/modules/types'
import type { GameAction } from '@server/modules/GameManager'
import ActionRow from '../ActionRow.vue'
import ActionCoordinates from '../ActionCoordinates.vue'
import PlayerName from '../PlayerName.vue'

const { action } = defineProps<{
  action: Extract<GameAction, { actionType: ActionTypes.PLACE_FOLLOWER }>
}>()

const emit = defineEmits<{
  zoom: [row: number, col: number]
}>()

const objectName = computed(() =>
  action.actionData.temporaryObject?.isMonastery
    ? 'монастырь'
    : action.actionData.temporaryObject?.isGarden
      ? 'сад'
      : action.actionData.point.pointType
)

const forwardZoom = (row: number, col: number) => {
  emit('zoom', row, col)
}
</script>
