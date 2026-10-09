<template>
  <ActionRow icon="i-lucide-rotate-ccw">
    <strong class="mr-[3px] text-text">Возврат подданных.</strong>
    <span v-for="group in followersByPlayer" :key="group.playerId">
      <PlayerName :color="playerColor(group.playerId)" :title="bigFollowerHint">
        {{ playerName(group.playerId) }} — {{ group.names.join(', ') }},&nbsp;
      </PlayerName>
    </span>
  </ActionRow>
</template>

<script setup lang="ts">
import { ActionTypes } from '@server/modules/types'
import type { GameAction } from '@server/modules/GameManager'
import type { Player } from '@server/modules/types'
import ActionRow from '../ActionRow.vue'
import PlayerName from '../PlayerName.vue'
import { playerById } from '../players'
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

const playerColor = (playerId: string | number) =>
  playerById(players, playerId)?.color

const playerName = (playerId: string | number) =>
  playerById(players, playerId)?.name
</script>
