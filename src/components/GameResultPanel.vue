<template>
  <div
    class="fixed inset-0 z-[4000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
    :data-testid="TEST_IDS.gameResultOverlay"
  >
    <div
      class="panel-parchment flex max-h-[90vh] w-full max-w-[26rem] flex-col gap-3 p-5 text-text"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <h2 class="title-medieval text-title leading-tight text-tertiary">
            {{ t('result_title') }}
          </h2>
          <p class="text-sm text-text-muted">{{ summaryText }}</p>
        </div>
        <UButton
          color="primary"
          icon="i-lucide-x"
          :title="t('result_close_title')"
          :aria-label="t('result_close_aria')"
          class="btn-secondary h-8 w-8 shrink-0 cursor-pointer !p-0"
          :ui="{ leadingIcon: 'size-4' }"
          :data-testid="TEST_IDS.gameResultClose"
          @click="emit('close')"
        />
      </div>

      <ul class="flex flex-col divide-y divide-border/70">
        <li
          v-for="result in results"
          :key="result.playerId"
          class="flex items-center gap-3 py-2"
          :data-testid="TEST_IDS.gameResultRow"
        >
          <span
            class="w-5 shrink-0 text-center text-sm font-bold tabular-nums"
            :class="result.isWinner ? 'text-secondary-dark' : 'text-text-muted'"
          >
            {{ result.place }}
          </span>
          <span
            class="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/20"
            :class="playerBackgroundColorClass(result.color)"
          ></span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-1 text-body font-semibold">
              <span class="truncate">{{ result.name }}</span>
              <UIcon
                v-if="result.isWinner"
                name="i-lucide-crown"
                class="h-4 w-4 shrink-0 text-secondary-dark"
                :title="t('result_winner')"
                :aria-label="t('result_winner')"
              />
            </span>
            <span
              v-if="breakdownItems(result).length"
              class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted"
            >
              <span
                v-for="item in breakdownItems(result)"
                :key="item.key"
                class="flex items-center gap-1"
                :title="item.title"
              >
                <UIcon :name="item.icon" class="h-3.5 w-3.5" />
                {{ item.value }}
              </span>
            </span>
          </span>
          <span class="text-title font-bold tabular-nums text-text">
            {{ result.total }}
          </span>
        </li>
      </ul>

      <div class="flex flex-wrap items-center gap-2">
        <UButton
          color="primary"
          class="btn-primary-action min-h-10 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold"
          :data-testid="TEST_IDS.gameResultGoLobby"
          @click="emit('goLobby')"
        >
          {{ t('result_to_lobby') }}
        </UButton>
        <UButton
          color="primary"
          class="btn-secondary min-h-10 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold"
          :data-testid="TEST_IDS.gameResultPlayAgain"
          @click="emit('playAgain')"
        >
          {{ t('result_play_again') }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import type { IGameBoard } from '@/types/game'
import { TEST_IDS } from '@/data/testIds'
import { t } from '@/utils/i18n'
import { playerBackgroundColorClass } from '@/utils/colors'
import { buildGameResults, type PlayerResult } from '@/utils/gameResults'

const props = defineProps<{
  gameBoard: IGameBoard
}>()

const emit = defineEmits<{
  goLobby: []
  playAgain: []
  close: []
}>()

/** Итоговая таблица: места, очки и разбивка по источникам. */
const results = computed(() =>
  buildGameResults(
    props.gameBoard.players ?? [],
    props.gameBoard.scores,
    props.gameBoard.actionsHistory,
    props.gameBoard.winnerPlayerIds ?? []
  )
)

const summaryText = computed(() => {
  const winners = results.value.filter((result) => result.isWinner)
  if (winners.length === 0) return t('result_finished')
  if (winners.length === 1) {
    return t('result_winner_one', { name: winners[0].name })
  }
  return t('result_draw', {
    names: winners.map((winner) => winner.name).join(', '),
  })
})

/** Разбивка очков игрока: только те источники, где есть очки. */
const breakdownItems = (result: PlayerResult) => {
  const items = [
    {
      key: 'cities',
      icon: 'i-lucide-castle',
      get title() {
        return t('breakdown_cities')
      },
      value: result.breakdown.cities,
    },
    {
      key: 'roads',
      icon: 'i-lucide-route',
      get title() {
        return t('breakdown_roads')
      },
      value: result.breakdown.roads,
    },
    {
      key: 'monasteries',
      icon: 'i-lucide-church',
      get title() {
        return t('breakdown_monasteries')
      },
      value: result.breakdown.monasteries,
    },
    {
      key: 'gardens',
      icon: 'i-lucide-flower-2',
      get title() {
        return t('breakdown_gardens')
      },
      value: result.breakdown.gardens,
    },
    {
      key: 'fields',
      icon: 'i-lucide-sprout',
      get title() {
        return t('breakdown_fields')
      },
      value: result.breakdown.fields,
    },
  ].filter((item) => item.value > 0)

  if (result.breakdown.other > 0) {
    items.push({
      key: 'other',
      icon: 'i-lucide-coins',
      get title() {
        return t('breakdown_other')
      },
      value: result.breakdown.other,
    })
  }

  return items
}
</script>
