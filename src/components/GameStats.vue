<template>
  <UCard
    class="overflow-hidden rounded-lg shadow-strong"
    :ui="{ root: 'overflow-hidden rounded-lg', body: 'p-0' }"
  >
    <div
      :class="
        playerBackgroundColorClass(
          gameBoard.gameIsEnded
            ? winnerPlayer.color
            : gameBoard.currentPlayer?.color
        )
      "
      class="px-2.5 py-2 text-center text-[1.4em] font-medium text-black"
    >
      <template v-if="gameBoard.gameIsEnded">
        Победитель: {{ winnerPlayer.name }}
      </template>
      <template v-else> Ходит {{ gameBoard.currentPlayer?.name }} </template>
    </div>
    <div>
      <div v-for="player in [...gameBoard.players]" :key="player.id">
        <div class="px-2.5 py-2">
          <h2
            class="m-0 text-[1.2em] whitespace-nowrap text-black"
          >
            <span :class="playerTextColorClass(player.color)">{{
              player.name
            }}</span>
            -
            {{ gameBoard.scores[player.id] }}
            <span
              v-for="n in gameBoard.playersFollowers[player.id]
                .ordinaryFollowers"
              :key="n"
              >+</span
            >
          </h2>
        </div>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import UCard from '@nuxt/ui/components/Card.vue'
import type { IGameBoard } from '@/types/game'
import type { CompletedObjects, PlayerId } from '@server/modules/types'
import { computed } from 'vue'
import {
  playerBackgroundColorClass,
  playerTextColorClass,
} from '@/utils/colors'

const props = defineProps<{
  gameBoard: IGameBoard
}>()

const getCompletedObjectsForPlayer = (
  objectType: keyof CompletedObjects,
  playerId: PlayerId
) => {
  return (
    props.gameBoard?.completedObjects[objectType].filter(
      (object) => object.score?.players[playerId]
    ) || []
  )
}

const winnerPlayer = computed(() => {
  let winner = { name: '', color: null as string | null, score: 0 }
  Object.values(props.gameBoard.scores).forEach((score, index) => {
    if (score > winner.score) {
      const player = props.gameBoard.players[index]
      winner = {
        name: player?.name ?? '',
        color: player?.color ?? null,
        score,
      }
    }
  })
  return winner
})
</script>
