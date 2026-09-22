<template>
  <Draggable
    v-if="gameBoard.gameIsStarted"
    draggable-id="game-controls"
    :initial-x="600"
    :initial-y="10"
  >
    <!--    <div class="game-controls">-->
    <!--      <template v-if="gameBoard.gameIsStarted">-->
    <!--        <button @click="gameBoard.autoPlay">Auto Play</button>-->
    <!--        <button @click="calculateBestMove" class="calculate-move-btn">Calculate Best Move</button>-->

    <!--        <button @click="zoomToLastPlacement">Zoom</button>-->
    <!--        <div class="game-current-player">-->
    <!--          <div class="game-current-player__title">Ход игрока {{ gameBoard.currentPlayer.name }}</div>-->
    <!--        </div>-->
    <!--      </template>-->
    <!--    </div>-->
    <GameStats :game-board="gameBoard" />
  </Draggable>
</template>
<script setup lang="ts">
import GameStats from '@/components/GameStats.vue'
import { GameSimulatorModule } from '@server/modules/GameSimulatorModule'
import Draggable from '@/components/Draggable.vue'
import type { IGameBoard } from '@/types/game'
import type { IGameBoard as ServerGameBoard } from '@server/modules/GameManager'

const props = defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})

const calculateBestMove = () => {
  const board = props.gameBoard as unknown as ServerGameBoard
  if (!board.currentTile) return

  const tileForSim = {
    ...board.currentTile,
    sides: { ...board.currentTile.sides },
  }

  const simulator = new GameSimulatorModule(board)
  const result = simulator.findBestMove(tileForSim)

  if (result.score > -1) {
    const move = result.moves[0]
    if (move) {
      board.placeTile(move.tile, move.rowIndex, move.tileIndex)

      if (move.followerPlace) {
        board.placeFollower(move.followerPlace)
      }
    }
  }
}
</script>
