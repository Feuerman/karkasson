<template>
  <Draggable
    v-if="gameBoard.gameIsStarted"
    draggable-id="game-controls"
    :initial-x="600"
    :initial-y="10"
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
})
</script>
