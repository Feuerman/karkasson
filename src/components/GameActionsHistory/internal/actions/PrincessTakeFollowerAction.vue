<template>
  <ActionRow icon="i-lucide-crown">
    <strong class="mr-[3px] text-text">Принцесса забрала подданного.</strong>
    <span class="text-text">
      Город на клетке
      <ActionCoordinates
        :row="takenFollower.point.y"
        :col="takenFollower.point.x"
        @zoom="forwardZoom"
      />
    </span>
    <span class="text-text"> Подданный: </span>
    <PlayerName
      :color="playerColor(takenFollower.playerId)"
      :title="takenFollower.isBigFollower ? BIG_FOLLOWER_HINT : undefined"
    >
      {{ playerName(takenFollower.playerId) }} — {{ takenFollowerName }}
    </PlayerName>
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
import { BIG_FOLLOWER_HINT, followerName } from '../followerNames'

const { action, players } = defineProps<{
  action: Extract<
    GameAction,
    { actionType: ActionTypes.PRINCESS_TAKE_FOLLOWER }
  >
  players: Player[]
}>()

const emit = defineEmits<{
  zoom: [row: number, col: number]
}>()

const takenFollower = computed(() => action.actionData.takenFollower)

const takenFollowerName = computed(() =>
  followerName(action.actionData.takenFollower)
)

const playerColor = (playerId: string | number) =>
  playerById(players, playerId)?.color

const playerName = (playerId: string | number) =>
  playerById(players, playerId)?.name

const forwardZoom = (row: number, col: number) => {
  emit('zoom', row, col)
}
</script>
