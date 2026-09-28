<template>
  <Draggable
    v-if="gameBoard.gameIsStarted"
    draggable-id="player-stats"
    :initial-x="16"
    :initial-y="16"
    :drag-enabled="dragEnabled"
  >
    <GameStats :game-board="gameBoard" />
  </Draggable>
</template>
<script setup lang="ts">
import GameStats from '@/components/GameStats.vue'
import Draggable from '@/components/Draggable.vue'
import type { IGameBoard } from '@/types/game'

defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
  dragEnabled: {
    type: Boolean,
    default: false,
  },
})
</script>
