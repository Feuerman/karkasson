<template>
  <div
    :data-testid="entry.isMe ? TEST_IDS.gameStatsOwnPlayer : undefined"
    class="flex items-center gap-3 px-2 py-2.5"
    :class="
      entry.isMe
        ? 'rounded-lg bg-gold/15 shadow-[inset_0_0_0_1px_rgba(163,124,44,0.35)]'
        : ''
    "
  >
    <span
      class="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/20"
      :class="playerBackgroundColorClass(entry.player.color)"
    ></span>
    <span
      :title="entry.player.name ?? ''"
      class="min-w-0 flex-1 truncate text-[1.05rem] font-semibold text-text"
    >
      <span class="mr-1">{{ entry.player.name }}</span>
      <UIcon
        v-if="entry.isLeader"
        name="i-lucide-crown"
        class="inline h-4 w-4 align-[-1px] text-gold-dark"
        title="Лидер по очкам"
        aria-label="Лидер по очкам"
      />
      <span
        v-if="entry.isMe"
        class="ml-1 rounded bg-gold/30 px-1 text-[.7rem] font-bold tracking-wide text-wood-dark uppercase"
      >
        Вы
      </span>
    </span>
    <span class="flex shrink-0 items-center gap-1.5 text-[.85rem] tabular-nums">
      <span
        :title="`${followers.ordinaryFollowers} подданных в запасе`"
        class="flex items-center gap-1"
      >
        <span
          class="inline-block h-2.5 w-2.5 rounded-[3px] border border-black/25"
          :class="playerBackgroundColorClass(entry.player.color)"
        />
        {{ followers.ordinaryFollowers }}
      </span>
      <span
        v-if="followers.bigFollowers !== undefined"
        class="flex items-center gap-1"
        :title="`${followers.bigFollowers ?? 0} больших подданных в запасе`"
      >
        <UIcon name="i-lucide-users-round" class="h-4 w-4 text-gold-dark" />
        {{ followers.bigFollowers ?? 0 }}
      </span>
      <UIcon
        name="i-lucide-church"
        class="ml-0.5 h-4 w-4"
        :class="followers.monks > 0 ? 'text-gold-dark' : 'text-text-muted/40'"
        :title="followers.monks > 0 ? 'Аббат в запасе' : 'Аббат на поле'"
      />
    </span>
    <span class="flex shrink-0 flex-col items-end gap-0.5">
      <span
        :title="scoreBreakdownTitle"
        :data-testid="scoreChanged ? TEST_IDS.gameStatsScoreChanged : undefined"
        class="text-[1.1rem] font-bold tabular-nums text-text"
        :class="{ 'stats-score-bump': scoreChanged }"
      >
        {{ entry.score }}
      </span>
      <span
        v-if="turnScore > 0"
        :data-testid="TEST_IDS.gameStatsTurnScore"
        :title="`Очки за текущий ход: +${turnScore}`"
        class="rounded bg-success/15 px-1 text-[.65rem] leading-4 font-bold tabular-nums text-success-dark"
      >
        +{{ turnScore }}
      </span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import type { IGameBoard } from '@/types/game'
import type { RankedPlayer } from '@/utils/players'
import { TEST_IDS } from '@/data/testIds'
import { playerBackgroundColorClass } from '@/utils/colors'

const props = withDefaults(
  defineProps<{
    entry: RankedPlayer
    gameBoard: IGameBoard
    scoreChanged?: boolean
    turnScore?: number
    scoreBreakdownTitle?: string
  }>(),
  {
    scoreChanged: false,
    turnScore: 0,
    scoreBreakdownTitle: 'Очки за партию',
  }
)

const followers = computed(
  () =>
    props.gameBoard.playersFollowers[props.entry.player.id] ?? {
      ordinaryFollowers: 0,
      bigFollowers: 0,
      monks: 0,
    }
)
</script>
