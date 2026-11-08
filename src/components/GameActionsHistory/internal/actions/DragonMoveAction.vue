<template>
  <ActionRow icon="i-lucide-flame">
    <strong class="mr-[3px] text-text">{{ t('action_dragon_moved') }}</strong>
    <span class="text-text">
      {{ t('action_from_cell') }}
      <ActionCoordinates
        :row="action.actionData.from.rowIndex"
        :col="action.actionData.from.tileIndex"
        @zoom="forwardZoom"
      />
      {{ t('action_to_cell') }}
      <ActionCoordinates
        :row="action.actionData.to.rowIndex"
        :col="action.actionData.to.tileIndex"
        @zoom="forwardZoom"
      />
    </span>
    <span class="text-text-muted">
      {{
        t('action_steps_left', {
          steps: action.actionData.remainingSteps,
        })
      }}
    </span>
    <template v-if="hasEatenFollowers">
      <span class="text-text"> {{ t('action_eaten_followers') }} </span>
      <span v-for="group in eatenByPlayer" :key="group.playerId">
        <PlayerNameById :player-id="group.playerId" :title="bigFollowerHint">
          — {{ group.names.join(', ') }}&nbsp;
        </PlayerNameById>
      </span>
    </template>
  </ActionRow>
</template>

<script setup lang="ts">
import { ActionTypes } from '@server/modules/types'
import type { GameAction } from '@server/modules/gameActions'
import { computed } from 'vue'
import ActionRow from '../ActionRow.vue'
import ActionCoordinates from '../ActionCoordinates.vue'
import PlayerNameById from '../PlayerNameById.vue'
import {
  bigFollowerHint as bigFollowerHintText,
  groupFollowerNamesByPlayer,
  hasBigFollower,
} from '../followerNames'
import { t } from '@/utils/i18n'

const { action } = defineProps<{
  action: Extract<GameAction, { actionType: ActionTypes.DRAGON_MOVE }>
}>()

const emit = defineEmits<{
  zoom: [row: number, col: number]
}>()

const eatenByPlayer = computed(() =>
  groupFollowerNamesByPlayer(action.actionData.eatenFollowers)
)

const hasEatenFollowers = computed(() => eatenByPlayer.value.length > 0)

const bigFollowerHint = computed(() =>
  hasBigFollower(action.actionData.eatenFollowers)
    ? bigFollowerHintText()
    : undefined
)

const forwardZoom = (row: number, col: number) => {
  emit('zoom', row, col)
}
</script>
