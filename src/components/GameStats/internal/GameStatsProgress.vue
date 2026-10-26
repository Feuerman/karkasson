<template>
  <div class="mx-3 border-t border-gold-dark/40 py-2.5">
    <div class="flex items-center justify-between">
      <span class="flex items-center gap-2 text-sm font-semibold text-wood">
        <UIcon name="i-lucide-layers" class="h-4 w-4 text-gold-dark" />
        Прогресс
      </span>
      <span
        :data-testid="TEST_IDS.gameStatsTilesProgress"
        class="text-sm font-semibold tabular-nums text-wood-dark"
      >
        {{ progress.placedTiles }} / {{ progress.totalTiles }}
      </span>
    </div>
    <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-track">
      <div
        :data-testid="TEST_IDS.gameStatsTilesProgressBar"
        class="h-full rounded-full bg-gold-dark"
        :style="{ width: `${tilesProgressPercent}%` }"
      ></div>
    </div>
    <p class="mt-1.5 text-xs text-text-muted">
      В колоде: {{ progress.remainingTiles }}
    </p>
    <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-text-muted">
      <span
        v-for="object in objectSummaries"
        :key="object.key"
        class="flex items-center gap-1"
      >
        <UIcon :name="object.icon" class="h-3.5 w-3.5 shrink-0" />
        <span class="font-semibold tabular-nums text-wood">
          {{ object.value }}
        </span>
        {{ object.label }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'
import { TEST_IDS } from '@/data/testIds'

withDefaults(
  defineProps<{
    progress: {
      placedTiles: number
      totalTiles: number
      remainingTiles: number
    }
    tilesProgressPercent: number
    objectSummaries: {
      key: string
      icon: string
      value: number
      label: string
    }[]
  }>(),
  {
    objectSummaries: () => [],
  }
)
</script>
