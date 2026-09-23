<template>
  <div class="panel-parchment w-[270px] overflow-hidden text-text shadow-card">
    <div
      :class="playerBackgroundColorClass(headerColor)"
      class="flex items-center justify-center gap-2 px-3 py-2.5"
    >
      <UIcon
        :name="gameBoard.gameIsEnded ? 'i-lucide-crown' : 'i-lucide-footprints'"
        class="h-5 w-5 text-black/70"
      />
      <span
        class="title-medieval truncate text-lg leading-none font-bold text-black"
      >
        {{
          gameBoard.gameIsEnded
            ? winnerPlayer.name
            : gameBoard.currentPlayer?.name
        }}
      </span>
    </div>

    <div class="divide-y divide-border/70 px-2 py-1">
      <div
        v-for="player in [...gameBoard.players]"
        :key="player.id"
        class="flex items-center gap-3 px-2 py-2.5"
      >
        <span
          class="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/20"
          :class="playerBackgroundColorClass(player.color)"
        ></span>
        <span class="flex-1 truncate text-[1.05rem] font-semibold text-text">
          {{ player.name }}
        </span>
        <span class="flex items-center gap-1">
          <span
            v-for="n in gameBoard.playersFollowers[player.id].ordinaryFollowers"
            :key="n"
            class="inline-block h-2.5 w-2.5 rounded-[3px] border border-black/25"
            :class="playerBackgroundColorClass(player.color)"
          />
        </span>
        <span class="text-[1.1rem] font-bold tabular-nums text-text">
          {{ gameBoard.scores[player.id] }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import type { IGameBoard } from '@/types/game'
import { playerBackgroundColorClass } from '@/utils/colors'

const props = defineProps<{
  gameBoard: IGameBoard
}>()

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

const headerColor = computed(() => {
  return props.gameBoard.gameIsEnded
    ? winnerPlayer.value.color
    : props.gameBoard.currentPlayer?.color
})
</script>
