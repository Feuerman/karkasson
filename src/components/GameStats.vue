<template>
  <div class="game-stats">
    <div
      class="game-stats__header"
      :style="{
        backgroundColor: gameBoard.gameIsEnded
          ? winnerPlayer.color
          : gameBoard.currentPlayer.color,
      }"
    >
      <template v-if="gameBoard.gameIsEnded">
        Победил {{ winnerPlayer.name }}
      </template>
      <template v-else> Ходит {{ gameBoard.currentPlayer.name }} </template>
    </div>
    <div class="game-stats__players">
      <div v-for="player in [...gameBoard.players]" :key="player.id">
        <div class="game-stats__player">
          <h2>
            <span :style="{ color: player.color }">{{ player.name }}</span> -
            {{ gameBoard.scores[player.id] }}
            <span
              v-for="item in gameBoard.playersFollowers[player.id]
                .ordinaryFollowers"
              :key="item.id"
              >+</span
            >
          </h2>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type IGameBoard } from '../../server/src/modules/GameManager.ts'
import GameStatsCollapsed from './GameStatsCollapsed.vue'
import { computed } from 'vue'

const props = defineProps<{
  gameBoard: IGameBoard
}>()

const getCompletedObjectsForPlayer = (objectType, playerId) => {
  return (
    props.gameBoard?.completedObjects[objectType].filter(
      (object) => object.score?.players[playerId]
    ) || []
  )
}

const winnerPlayer = computed(() => {
  return Object.values(props.gameBoard.scores).reduce(
    (acc, score, index) => {
      if (score > acc.score) {
        acc = { ...props.gameBoard.players[index], score }
      }
      return acc
    },
    { name: '', score: 0 }
  )
})
</script>

<style scoped lang="scss">
.game-stats {
  background-color: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  &__title {
    position: sticky;
    top: 0;
    background-color: #fff;
    border-bottom: 1px solid #e0e0e0;
    font-size: 1.4rem;
    color: #333;
    margin-bottom: 10px;
    font-weight: 500;
  }
  &__header {
    padding: 10px;
    color: black;
    font-size: 1.4em;
    text-align: center;
    font-weight: 500;
  }
  &__player {
    padding: 10px;
    h2 {
      margin: 0;
      color: black;
      font-size: 1.2em;
    }
  }
}
</style>
