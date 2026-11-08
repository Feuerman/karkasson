<template>
  <ActionRow icon="i-lucide-layout-grid">
    <strong class="mr-[3px] text-text">{{ t('action_tile_placed') }}</strong>
    <PlayerName :color="action.initiator?.color">
      {{ action.initiator?.name }}.
    </PlayerName>
    <span class="text-text">
      {{ t('action_tile_on_cell', { id: action.actionData.tile.id }) }}
      <ActionCoordinates
        :row="action.actionData.rowIndex"
        :col="action.actionData.tileIndex"
        @zoom="forwardZoom"
      />
    </span>
  </ActionRow>
</template>

<script setup lang="ts">
import { ActionTypes } from '@server/modules/types'
import type { GameAction } from '@server/modules/gameActions'
import ActionRow from '../ActionRow.vue'
import ActionCoordinates from '../ActionCoordinates.vue'
import PlayerName from '../PlayerName.vue'
import { t } from '@/utils/i18n'

const { action } = defineProps<{
  action: Extract<GameAction, { actionType: ActionTypes.PLACE_TILE }>
}>()

const emit = defineEmits<{
  zoom: [row: number, col: number]
}>()

const forwardZoom = (row: number, col: number) => {
  emit('zoom', row, col)
}
</script>
