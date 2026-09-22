<template>
  <div class="m-2.5">
    <button
      :disabled="!canMakeMove"
      class="cursor-pointer rounded border-0 bg-success px-4 py-2 text-white transition-colors duration-200 hover:bg-success-dark disabled:cursor-not-allowed disabled:bg-[#cccccc]"
      @click="makeAIMove"
    >
      Make AI Move
    </button>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { GameSimulator } from '../modules/GameSimulator'
import type { GameBoard } from '../modules/GameBoard'

const props = defineProps<{
  gameBoard: GameBoard
}>()

const canMakeMove = computed(() => {
  return props.gameBoard.gameIsStarted && props.gameBoard.currentTile
})

const makeAIMove = () => {
  if (!props.gameBoard.currentTile) return

  const simulator = new GameSimulator(props.gameBoard)
  const bestMove = simulator.findBestMove(props.gameBoard.currentTile)

  if (bestMove.score === -1) {
    return
  }

  // Apply the best move
  const move = bestMove.moves[0]

  // Rotate tile to match the simulation
  for (let i = 0; i < move.rotation / 90; i++) {
    props.gameBoard.rotateTile('clockwise')
  }

  // Place the tile
  props.gameBoard.placeTile(move.tile, move.rowIndex, move.tileIndex)

  // Place follower if specified
  if (move.followerPlace) {
    props.gameBoard.placeFollower(move.followerPlace)
  }
}
</script>
