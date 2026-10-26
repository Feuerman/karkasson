<template>
  <div class="mx-3 border-t border-gold-dark/40 py-2.5">
    <div class="flex items-center justify-between gap-2">
      <span class="flex items-center gap-1.5 text-sm font-semibold text-wood">
        <UIcon name="i-lucide-hourglass" class="h-4 w-4 text-gold-dark" />
        Ход
      </span>
      <span
        :data-testid="TEST_IDS.gameStatsTurnTimer"
        class="text-sm font-semibold tabular-nums text-wood-dark"
      >
        {{ turnDuration }}
      </span>
    </div>
    <div class="mt-1.5 flex items-center justify-between gap-2 text-sm">
      <span class="min-w-0 truncate text-text-muted">
        Ходит:
        <span class="font-semibold text-wood">{{ currentPlayerName }}</span>
      </span>
      <span
        v-if="isComputerTurn"
        :data-testid="TEST_IDS.gameStatsComputerThinking"
        class="flex shrink-0 items-center gap-1.5 text-xs text-text-muted"
      >
        <span
          class="stats-thinking-dot h-2 w-2 rounded-full bg-gold-dark"
          aria-hidden="true"
        ></span>
        думает
      </span>
    </div>
    <div
      v-if="nextPlayerName"
      class="mt-1 flex items-center justify-between gap-2 text-sm"
    >
      <span class="min-w-0 truncate text-text-muted">
        Далее:
        <span class="font-semibold text-wood">{{ nextPlayerName }}</span>
      </span>
      <ol class="flex shrink-0 items-center gap-1" aria-label="Очередь ходов">
        <li
          v-for="(player, index) in turnOrder"
          :key="String(player.id)"
          :title="turnOrderTitle(player, index)"
        >
          <span
            class="flex h-5 w-5 items-center justify-center rounded-full text-[.6rem] font-bold text-black/75 ring-1 ring-black/15"
            :class="[
              playerBackgroundColorClass(player.color),
              index === 0 ? 'ring-2 ring-gold-dark' : 'opacity-75',
            ]"
          >
            {{ initialOf(player.name) }}
          </span>
        </li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'
import type { Player } from '@server/modules/types'
import { TEST_IDS } from '@/data/testIds'
import { playerBackgroundColorClass } from '@/utils/colors'

withDefaults(
  defineProps<{
    turnDuration: string
    currentPlayerName: string
    isComputerTurn: boolean
    nextPlayerName: string | null
    turnOrder: Player[]
    gameIsEnded: boolean
  }>(),
  {
    nextPlayerName: null,
    turnOrder: () => [],
    gameIsEnded: false,
  }
)

const initialOf = (name?: string | null): string =>
  name?.trim().charAt(0).toLocaleUpperCase('ru') || '?'

const turnOrderTitle = (player: Player, index: number): string => {
  const name = player.name || 'Игрок'
  return index === 0 ? `Ходит сейчас: ${name}` : `В очереди: ${name}`
}
</script>
