<template>
  <ActionRow icon="i-lucide-coins">
    <strong class="mr-[3px] text-text">Завершён объект.</strong>
    <span @click="emit('highlightObject', action.actionData.objectData)">
      {{ action.actionData.objectType }}.
    </span>
    <span class="text-text">Начислено очков:</span>
    <span
      v-for="(score, playerId) in action.actionData.score.players"
      :key="playerId"
    >
      <PlayerName :color="playerColor(playerId)">
        {{ playerName(playerId) }} — {{ score ?? 0 }}
        {{ pluralForm(score ?? 0, 'очко', 'очка', 'очков') }},
      </PlayerName>
    </span>
  </ActionRow>
</template>

<script setup lang="ts">
import { ActionTypes } from '@server/modules/types'
import type { BaseObject, Player } from '@server/modules/types'
import type { GameAction } from '@server/modules/GameManager'
import { pluralForm } from '@/utils/common'
import ActionRow from '../ActionRow.vue'
import PlayerName from '../PlayerName.vue'
import { playerById } from '../players'

const { action, players } = defineProps<{
  action: Extract<GameAction, { actionType: ActionTypes.ADDING_SCORES }>
  players: Player[]
}>()

const emit = defineEmits<{
  highlightObject: [objectData: BaseObject]
}>()

const playerColor = (playerId: string | number) =>
  playerById(players, playerId)?.color

const playerName = (playerId: string | number) =>
  playerById(players, playerId)?.name
</script>
