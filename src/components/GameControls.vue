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
    <GameStats :gameBoard="gameBoard" />
  </Draggable>
</template>
<script setup lang="ts">
import { defineProps } from 'vue'
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

<style lang="scss" scoped>
.game-controls {
  background-color: #fff;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-width: 250px;

  &__title {
    font-size: 1.2rem;
    color: #333;
    margin-bottom: 1rem;
    font-weight: 500;
  }

  &__section {
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #e0e0e0;

    &:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
  }

  &__button {
    width: 100%;
    padding: 0.75rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: 0.5rem;

    &--primary {
      background-color: #2196f3;
      color: white;

      &:hover {
        background-color: #1976d2;
      }

      &:disabled {
        background-color: #bdbdbd;
        cursor: not-allowed;
      }
    }

    &--secondary {
      background-color: #f5f5f5;
      color: #333;

      &:hover {
        background-color: #e0e0e0;
      }
    }

    &--danger {
      background-color: #f44336;
      color: white;

      &:hover {
        background-color: #d32f2f;
      }
    }
  }

  &__info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background-color: #f5f5f5;
    border-radius: 4px;
    margin-bottom: 0.5rem;

    &-label {
      font-weight: 500;
      color: #666;
    }

    &-value {
      color: #333;
    }
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 4px;
    margin-bottom: 0.5rem;

    &--active {
      background-color: #e8f5e9;
      color: #2e7d32;
    }

    &--waiting {
      background-color: #fff3e0;
      color: #ef6c00;
    }

    &--finished {
      background-color: #f5f5f5;
      color: #616161;
    }
  }
}
</style>
