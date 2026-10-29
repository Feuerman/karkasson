<template>
  <div
    :data-testid="TEST_IDS.turnTracker"
    class="relative border-b-2 px-3 py-2"
    :class="[
      playerBackgroundColorClass(headerColor),
      isMyTurn ? 'border-secondary-dark' : 'border-transparent',
    ]"
  >
    <div class="flex items-center justify-center gap-2">
      <UIcon
        :name="gameBoard.gameIsEnded ? 'i-lucide-crown' : 'i-lucide-footprints'"
        class="h-5 w-5 text-black/70"
      />
      <span
        :title="gameBoard.gameIsEnded ? leaderLabel : currentPlayerLabel"
        :data-testid="TEST_IDS.gameStatsCurrentPlayer"
        class="title-medieval min-w-0 truncate text-title leading-none font-bold text-text"
      >
        {{ gameBoard.gameIsEnded ? leaderLabel : currentPlayerLabel }}
      </span>
      <span
        v-if="isMyTurn"
        :data-testid="TEST_IDS.gameStatsTurnBadge"
        class="stats-turn-pulse ml-1 h-2.5 w-2.5 shrink-0 rounded-pill bg-surface shadow-soft"
        aria-hidden="true"
      ></span>
      <PanelCollapseButton
        panel-id="player-stats"
        :collapsed="collapsed"
        class="absolute top-1 right-1"
        @toggle="toggle"
      />
    </div>
    <div
      v-if="!gameBoard.gameIsEnded"
      class="mt-1 flex items-center justify-center gap-1.5 px-3 text-sm font-bold text-text"
    >
      <span class="shrink-0 tabular-nums">ход {{ currentTurnNumber }}</span>
      <span
        class="h-1 w-1 shrink-0 rounded-full bg-black/30"
        aria-hidden="true"
      ></span>
      <span
        :data-testid="TEST_IDS.turnPhase"
        class="min-w-0 truncate"
        :title="phaseLabel"
      >
        {{ phaseLabel }}
      </span>
      <span
        v-if="isComputerTurn"
        class="shrink-0 rounded-sm bg-text/10 px-1 text-caption leading-4"
      >
        ИИ
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'
import PanelCollapseButton from '@/components/PanelCollapseButton.vue'
import type { IGameBoard } from '@/types/game'
import { TEST_IDS } from '@/data/testIds'
import { playerBackgroundColorClass } from '@/utils/colors'

withDefaults(
  defineProps<{
    gameBoard: IGameBoard
    currentPlayerLabel: string
    isMyTurn: boolean
    currentTurnNumber: number
    phaseLabel: string
    isComputerTurn: boolean
    headerColor: string | null
    collapsed: boolean
    toggle: () => void
    leaderLabel: string
  }>(),
  {
    leaderLabel: '',
  }
)
</script>
