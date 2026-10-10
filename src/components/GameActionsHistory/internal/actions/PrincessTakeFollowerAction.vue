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
    <PlayerNameById
      :players="players"
      :player-id="takenFollower.playerId"
      :title="takenFollower.isBigFollower ? BIG_FOLLOWER_HINT : undefined"
    >
      — {{ takenFollowerName }}
    </PlayerNameById>
  </ActionRow>
</template>

<script setup lang="ts">
import { ActionTypes } from '@server/modules/types'
import type { GameAction } from '@server/modules/GameManager'
import type { Player } from '@server/modules/types'
import { computed } from 'vue'
import ActionRow from '../ActionRow.vue'
import ActionCoordinates from '../ActionCoordinates.vue'
import PlayerNameById from '../PlayerNameById.vue'
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

const forwardZoom = (row: number, col: number) => {
  emit('zoom', row, col)
}
</script>
