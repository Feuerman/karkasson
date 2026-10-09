<template>
  <ActionRow icon="i-lucide-flame">
    <strong class="mr-[3px] text-text">Дракон переместился.</strong>
    <span class="text-text">
      С клетки
      <ActionCoordinates
        :row="action.actionData.from.rowIndex"
        :col="action.actionData.from.tileIndex"
        @zoom="forwardZoom"
      />
      на клетку
      <ActionCoordinates
        :row="action.actionData.to.rowIndex"
        :col="action.actionData.to.tileIndex"
        @zoom="forwardZoom"
      />
    </span>
    <span class="text-text-muted">
      Осталось шагов: {{ action.actionData.remainingSteps }}.
    </span>
    <template v-if="hasEatenFollowers">
      <span class="text-text"> Съедены подданные: </span>
      <span v-for="group in eatenByPlayer" :key="group.playerId">
        <PlayerName
          :color="playerColor(group.playerId)"
          :title="bigFollowerHint"
        >
          {{ playerName(group.playerId) }} — {{ group.names.join(', ') }}&nbsp;
        </PlayerName>
      </span>
    </template>
  </ActionRow>
</template>

<script setup lang="ts">
import { ActionTypes } from '@server/modules/types'
import type { GameAction } from '@server/modules/GameManager'
import type { Player } from '@server/modules/types'
import { computed } from 'vue'
import ActionRow from '../ActionRow.vue'
import ActionCoordinates from '../ActionCoordinates.vue'
import PlayerName from '../PlayerName.vue'
import { playerById } from '../players'
import {
  BIG_FOLLOWER_HINT,
  groupFollowerNamesByPlayer,
  hasBigFollower,
} from '../followerNames'

const { action, players } = defineProps<{
  action: Extract<GameAction, { actionType: ActionTypes.DRAGON_MOVE }>
  players: Player[]
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
    ? BIG_FOLLOWER_HINT
    : undefined
)

const playerColor = (playerId: string | number) =>
  playerById(players, playerId)?.color

const playerName = (playerId: string | number) =>
  playerById(players, playerId)?.name

const forwardZoom = (row: number, col: number) => {
  emit('zoom', row, col)
}
</script>
