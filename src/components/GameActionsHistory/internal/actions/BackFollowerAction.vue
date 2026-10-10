<template>
  <ActionRow icon="i-lucide-rotate-ccw">
    <strong class="mr-[3px] text-text">Возврат подданных.</strong>
    <span v-for="group in followersByPlayer" :key="group.playerId">
      <PlayerNameById
        :players="players"
        :player-id="group.playerId"
        :title="bigFollowerHint"
      >
        {{ group.names.join(', ') }},&nbsp;
      </PlayerNameById>
    </span>
  </ActionRow>
</template>

<script setup lang="ts">
import { ActionTypes } from '@server/modules/types'
import type { GameAction } from '@server/modules/GameManager'
import type { Player } from '@server/modules/types'
import ActionRow from '../ActionRow.vue'
import PlayerNameById from '../PlayerNameById.vue'
import {
  groupFollowerNamesByPlayer,
  hasBigFollower,
  BIG_FOLLOWER_HINT,
} from '../followerNames'
import { computed } from 'vue'

const { action, players } = defineProps<{
  action: Extract<GameAction, { actionType: ActionTypes.BACK_FOLLOWER }>
  players: Player[]
}>()

const followersByPlayer = computed(() =>
  groupFollowerNamesByPlayer(action.actionData.followers)
)

const bigFollowerHint = computed(() =>
  hasBigFollower(action.actionData.followers) ? BIG_FOLLOWER_HINT : undefined
)
</script>
