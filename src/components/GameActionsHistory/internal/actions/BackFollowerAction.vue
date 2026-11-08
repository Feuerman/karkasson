<template>
  <ActionRow icon="i-lucide-rotate-ccw">
    <strong class="mr-[3px] text-text">{{
      t('action_returned_followers')
    }}</strong>
    <span v-for="group in followersByPlayer" :key="group.playerId">
      <PlayerNameById :player-id="group.playerId" :title="bigFollowerHint">
        — {{ group.names.join(', ') }},&nbsp;
      </PlayerNameById>
    </span>
  </ActionRow>
</template>

<script setup lang="ts">
import { ActionTypes } from '@server/modules/types'
import type { GameAction } from '@server/modules/gameActions'
import ActionRow from '../ActionRow.vue'
import PlayerNameById from '../PlayerNameById.vue'
import {
  groupFollowerNamesByPlayer,
  hasBigFollower,
  bigFollowerHint as bigFollowerHintText,
} from '../followerNames'
import { t } from '@/utils/i18n'
import { computed } from 'vue'

const { action } = defineProps<{
  action: Extract<GameAction, { actionType: ActionTypes.BACK_FOLLOWER }>
}>()

const followersByPlayer = computed(() =>
  groupFollowerNamesByPlayer(action.actionData.followers)
)

const bigFollowerHint = computed(() =>
  hasBigFollower(action.actionData.followers)
    ? bigFollowerHintText()
    : undefined
)
</script>
