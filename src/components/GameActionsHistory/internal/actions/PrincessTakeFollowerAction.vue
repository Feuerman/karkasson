<template>
  <ActionRow icon="i-lucide-crown">
    <strong class="mr-[3px] text-text">{{ t('action_princess_took') }}</strong>
    <span class="text-text">
      {{ t('action_city_on_cell') }}
      <ActionCoordinates
        :row="takenFollower.point.y"
        :col="takenFollower.point.x"
        @zoom="forwardZoom"
      />
    </span>
    <span class="text-text"> {{ t('action_follower_label') }} </span>
    <PlayerNameById
      :player-id="takenFollower.playerId"
      :title="takenFollower.isBigFollower ? bigFollowerHintText() : undefined"
    >
      — {{ takenFollowerName }}
    </PlayerNameById>
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
  followerName,
} from '../followerNames'
import { t } from '@/utils/i18n'

const { action } = defineProps<{
  action: Extract<
    GameAction,
    { actionType: ActionTypes.PRINCESS_TAKE_FOLLOWER }
  >
}>()

const emit = defineEmits<{
  zoom: [row: number, col: number]
}>()

const takenFollower = computed(() => action.actionData.takenFollower)

const takenFollowerName = computed(() =>
  followerName(action.actionData.takenFollower)
)

const forwardZoom = (row: number, col: number) => {
  emit('zoom', row, col)
}
</script>
