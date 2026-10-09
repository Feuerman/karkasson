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
    <template v-if="eatenByPlayer.length">
      <span class="text-text"> Съедены подданные: </span>
      <span v-for="(count, playerId) in eatenByPlayer" :key="playerId">
        <PlayerName :color="playerColor(playerId)">
          {{ playerName(playerId) }} — {{ followerLabel(count) }}&nbsp;
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
import { countBy, pluralForm } from '@/utils/common'
import ActionRow from '../ActionRow.vue'
import ActionCoordinates from '../ActionCoordinates.vue'
import PlayerName from '../PlayerName.vue'
import { playerById } from '../players'

const { action, players } = defineProps<{
  action: Extract<GameAction, { actionType: ActionTypes.DRAGON_MOVE }>
  players: Player[]
}>()

const emit = defineEmits<{
  zoom: [row: number, col: number]
}>()

const eatenByPlayer = computed(() =>
  countBy(action.actionData.eatenFollowers, (follower) =>
    String(follower.playerId)
  )
)

const followerLabel = (count: number) =>
  `${count} ${pluralForm(count, 'подданный', 'подданных', 'подданных')}`

const playerColor = (playerId: string | number) =>
  playerById(players, playerId)?.color

const playerName = (playerId: string | number) =>
  playerById(players, playerId)?.name

const forwardZoom = (row: number, col: number) => {
  emit('zoom', row, col)
}
</script>
