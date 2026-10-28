<template>
  <div
    class="fixed bottom-6 left-1/2 z-[3000] flex -translate-x-1/2 flex-col items-center gap-3"
  >
    <div
      v-if="placementError"
      role="alert"
      :data-testid="TEST_IDS.placementError"
      class="max-w-[min(92vw,32rem)] rounded-xl border border-danger/70 bg-danger/15 px-4 py-2 text-sm leading-snug font-medium text-danger-dark shadow-soft backdrop-blur-sm"
    >
      <span class="flex items-start gap-2">
        <UIcon name="i-lucide-alert-triangle" class="mt-0.5 h-4 w-4 shrink-0" />
        <span>{{ placementError }}</span>
      </span>
    </div>
    <div
      v-if="!hasSelectedCell"
      class="flex flex-col items-center gap-2"
      :data-testid="TEST_IDS.pendingTilePreview"
    >
      <div class="relative">
        <div class="absolute left-[-34px] top-1/2 -translate-y-1/2">
          <UButton
            color="primary"
            icon="i-lucide-rotate-ccw"
            class="btn-primary-action flex h-8 w-8 cursor-pointer !p-0 text-white shadow-soft"
            :ui="{ leadingIcon: 'size-4' }"
            title="Повернуть тайл против часовой стрелки"
            aria-label="Повернуть тайл против часовой стрелки"
            :data-testid="TEST_IDS.rotateTileCounterclockwise"
            @mousedown.stop
            @click.stop.prevent="
              emit('rotate-tile', RotationDirection.Counterclockwise)
            "
          />
        </div>
        <div
          class="overflow-hidden rounded-xl shadow-strong ring-1 ring-black/10"
          :style="{ width: `${tileSize}px`, height: `${tileSize}px` }"
        >
          <TileView
            :tile="localCurrentTile"
            :size="tileSize"
            class="h-full w-full"
          />
        </div>
        <div class="absolute right-[-34px] top-1/2 -translate-y-1/2">
          <UButton
            color="primary"
            icon="i-lucide-rotate-cw"
            class="btn-primary-action flex h-8 w-8 cursor-pointer !p-0 text-white shadow-soft"
            :ui="{ leadingIcon: 'size-4' }"
            title="Повернуть тайл по часовой стрелке"
            aria-label="Повернуть тайл по часовой стрелке"
            :data-testid="TEST_IDS.rotateTileClockwise"
            @mousedown.stop
            @click.stop.prevent="
              emit('rotate-tile', RotationDirection.Clockwise)
            "
          />
        </div>
      </div>
      <span
        class="rounded-lg bg-black/50 px-3 py-1 text-sm font-medium whitespace-nowrap text-amber-50 backdrop-blur-sm"
      >
        Выберите клетку на поле
      </span>
      <span
        class="hidden rounded-lg bg-black/40 px-3 py-1 text-[.8rem] whitespace-nowrap text-amber-50/80 backdrop-blur-sm sm:inline"
      >
        Клавиши: R — повернуть, P — разместить, Esc — снять выбор
      </span>
    </div>
    <UButton
      color="success"
      icon="i-lucide-map-pin"
      :disabled="!hasSelectedCell"
      :title="
        hasSelectedCell
          ? 'Разместить тайл на выбранной клетке'
          : 'Сначала выберите клетку на поле'
      "
      class="btn-primary-action min-h-12 cursor-pointer whitespace-nowrap rounded-xl px-6 py-2 text-base font-semibold shadow-strong"
      :data-testid="TEST_IDS.placeTile"
      @click="emit('place-tile', localCurrentTile, hoveredTile)"
    >
      Разместить
    </UButton>
  </div>
</template>

<script setup lang="ts">
import type { Tile } from '@server/modules/types'
import { RotationDirection } from '@server/modules/types'
import type { BoardCell } from '@/types/game'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import TileView from '@/components/TileView.vue'
import { TEST_IDS } from '@/data/testIds'

defineProps<{
  placementError: string
  hasSelectedCell: boolean
  localCurrentTile: Tile | null
  hoveredTile: BoardCell
  tileSize: number
}>()

const emit = defineEmits<{
  'rotate-tile': [direction: RotationDirection]
  'place-tile': [tile: Tile | null, point: BoardCell]
}>()
</script>
