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
        :title="gameBoard.gameIsEnded ? winnerPlayer.name : currentPlayerLabel"
        class="title-medieval min-w-0 truncate text-lg leading-none font-bold text-black"
      >
        {{ gameBoard.gameIsEnded ? winnerPlayer.name : currentPlayerLabel }}
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
        <span
          :title="player.name ?? ''"
          class="min-w-0 flex-1 truncate text-[1.05rem] font-semibold text-text"
        >
          {{ player.name }}
        </span>
        <span class="flex shrink-0 items-center gap-1 text-xs tabular-nums">
          <span
            :title="`${gameBoard.playersFollowers[player.id].ordinaryFollowers} подданных в запасе`"
            class="flex items-center gap-1"
          >
            <span
              class="inline-block h-2.5 w-2.5 rounded-[3px] border border-black/25"
              :class="playerBackgroundColorClass(player.color)"
            />
            {{ gameBoard.playersFollowers[player.id].ordinaryFollowers }}
          </span>
          <span
            v-if="
              gameBoard.playersFollowers[player.id].bigFollowers !== undefined
            "
            class="flex items-center gap-1"
            :title="`${gameBoard.playersFollowers[player.id].bigFollowers ?? 0} больших подданных в запасе`"
          >
            <UIcon name="i-lucide-users-round" class="h-4 w-4 text-gold-dark" />
            {{ gameBoard.playersFollowers[player.id].bigFollowers ?? 0 }}
          </span>
          <UIcon
            name="i-lucide-church"
            class="ml-1 h-4 w-4"
            :class="
              gameBoard.playersFollowers[player.id].monks > 0
                ? 'text-gold-dark'
                : 'text-text-muted/40'
            "
            :title="
              gameBoard.playersFollowers[player.id].monks > 0
                ? 'Аббат в запасе'
                : 'Аббат на поле'
            "
          />
        </span>
        <span class="text-[1.1rem] font-bold tabular-nums text-text">
          {{ gameBoard.scores[player.id] }}
        </span>
      </div>
    </div>
    <div
      v-if="gameBoard.tilesList.length"
      class="mx-3 border-t border-gold-dark/40 py-2.5"
    >
      <div
        class="flex items-center justify-between rounded-lg border border-gold-dark/35 bg-gold/15 px-3 py-2"
      >
        <span class="flex items-center gap-2 text-sm font-semibold text-wood">
          <UIcon name="i-lucide-layers" class="h-4 w-4 text-gold-dark" />
          Тайлов в колоде
        </span>
        <span
          class="rounded-md bg-gold/30 px-2 py-0.5 text-base font-bold tabular-nums text-wood-dark"
        >
          {{ gameBoard.tilesList.length }}
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

const currentPlayerLabel = computed(() =>
  props.gameBoard.isMyTurn
    ? 'Ваш ход'
    : (props.gameBoard.currentPlayer?.name ?? '')
)

const headerColor = computed(() => {
  return props.gameBoard.gameIsEnded
    ? winnerPlayer.value.color
    : props.gameBoard.currentPlayer?.color
})
</script>
