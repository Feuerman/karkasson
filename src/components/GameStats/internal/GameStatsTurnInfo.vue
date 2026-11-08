<template>
  <div class="mx-3 border-t border-secondary-dark/40 py-2.5">
    <div class="flex items-center justify-between gap-2">
      <span
        class="flex items-center gap-1.5 text-sm font-semibold text-tertiary-soft"
      >
        <UIcon name="i-lucide-hourglass" class="h-4 w-4 text-secondary-dark" />
        {{ t('stats_turn') }}
      </span>
      <span
        :data-testid="TEST_IDS.gameStatsTurnTimer"
        class="text-sm font-semibold tabular-nums text-tertiary"
      >
        {{ turnDuration }}
      </span>
    </div>
    <div class="mt-1.5 flex items-center justify-between gap-2 text-sm">
      <span class="min-w-0 truncate text-text-muted">
        {{ t('stats_current') }}
        <span class="font-semibold text-tertiary-soft">{{
          currentPlayerName
        }}</span>
      </span>
      <span
        v-if="isComputerTurn"
        :data-testid="TEST_IDS.gameStatsComputerThinking"
        class="flex shrink-0 items-center gap-1.5 text-xs text-text-muted"
      >
        <span
          class="stats-thinking-dot h-2 w-2 rounded-pill bg-secondary-dark"
          aria-hidden="true"
        ></span>
        {{ t('stats_thinking') }}
      </span>
    </div>
    <div
      v-if="nextPlayerName"
      class="mt-1 flex items-center justify-between gap-2 text-sm"
    >
      <span class="min-w-0 truncate text-text-muted">
        {{ t('stats_next') }}
        <span class="font-semibold text-tertiary-soft">{{
          nextPlayerName
        }}</span>
      </span>
      <ol
        class="flex shrink-0 items-center gap-1"
        :aria-label="t('stats_turn_order')"
      >
        <li
          v-for="(player, index) in turnOrder"
          :key="String(player.id)"
          :title="turnOrderTitle(player, index)"
        >
          <span
            class="flex h-5 w-5 items-center justify-center rounded-pill text-caption font-bold ring-1 ring-border/15"
            :class="[
              playerBackgroundColorClass(player.color),
              playerBackgroundTextColorClass(player.color),
              index === 0 ? 'ring-2 ring-secondary-dark' : 'opacity-75',
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
import type { PlayerView } from '@server/modules/types'
import { TEST_IDS } from '@/data/testIds'
import {
  playerBackgroundColorClass,
  playerBackgroundTextColorClass,
} from '@/utils/colors'
import { getLocale, t } from '@/utils/i18n'

withDefaults(
  defineProps<{
    turnDuration: string
    currentPlayerName: string
    isComputerTurn: boolean
    nextPlayerName: string | null
    turnOrder: PlayerView[]
    gameIsEnded: boolean
  }>(),
  {
    nextPlayerName: null,
    turnOrder: () => [],
    gameIsEnded: false,
  }
)

const initialOf = (name?: string | null): string =>
  name?.trim().charAt(0).toLocaleUpperCase(getLocale()) || '?'

const turnOrderTitle = (player: PlayerView, index: number): string => {
  const name = player.name || t('stats_player')
  return index === 0
    ? t('stats_playing_now', { name })
    : t('stats_in_queue', { name })
}
</script>
