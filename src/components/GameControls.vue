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
import { type IGameBoard } from '../../server/src/modules/GameManager.ts'
import { GameSimulatorModule } from '../../server/src/modules/GameSimulatorModule.ts'
import Draggable from '@/components/Draggable.vue'

const props = defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})

const calculateBestMove = () => {
  if (!props.gameBoard.currentTile) return

  const tileForSim = {
    ...props.gameBoard.currentTile,
    sides: { ...props.gameBoard.currentTile.sides },
  }

  const simulator = new GameSimulatorModule(props.gameBoard)
  const result = simulator.findBestMove(tileForSim)

  if (result.score > -1) {
    const move = result.moves[0]
    if (move) {
      props.gameBoard.placeTile(move.tile, move.rowIndex, move.tileIndex)

      if (move.followerPlace) {
        props.gameBoard.placeFollower(move.followerPlace)
      }
    }
  }
}
</script>
