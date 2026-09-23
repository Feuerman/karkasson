<template>
  <ActionRow icon="i-lucide-rotate-ccw">
    <strong class="mr-[3px] text-text">Возврат подданных.</strong>
    <span
      v-for="(count, playerId) in followersByPlayer"
      :key="playerId"
    >
      <PlayerName :color="playerColor(playerId)">
        {{ playerName(playerId) }} — {{ count }},&nbsp;
      </PlayerName>
    </span>
  </ActionRow>
</template>

<script setup lang="ts">
import { ActionTypes } from '@server/modules/types'
import type { GameAction } from '@server/modules/GameManager'
import type { Player } from '@server/modules/types'
import { countBy } from '@/utils/common'
import ActionRow from '../ActionRow.vue'
import PlayerName from '../PlayerName.vue'
import { playerById } from '../players'
import { computed } from 'vue'

const { action, players } = defineProps<{
  action: Extract<GameAction, { actionType: ActionTypes.BACK_FOLLOWER }>
  players: Player[]
}>()

const followersByPlayer = computed(() =>
  countBy(
    action.actionData.followers,
    (follower) => String(follower.playerId)
  )
)

const playerColor = (playerId: string | number) =>
  playerById(players, playerId)?.color

const playerName = (playerId: string | number) =>
  playerById(players, playerId)?.name
</script>
