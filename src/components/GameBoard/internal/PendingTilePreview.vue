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
            :title="t('board_rotate_ccw')"
            :aria-label="t('board_rotate_ccw')"
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
            :title="t('board_rotate_cw')"
            :aria-label="t('board_rotate_cw')"
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
        {{ t('board_choose_cell') }}
      </span>
      <span
        class="hidden rounded-card bg-black/40 px-3 py-1 text-caption whitespace-nowrap text-amber-50/80 backdrop-blur-sm sm:inline"
      >
        {{ t('board_keys_hint') }}
      </span>
    </div>
    <UButton
      color="success"
      icon="i-lucide-map-pin"
      :disabled="!hasSelectedCell"
      :title="
        hasSelectedCell
          ? t('board_place_on_selected')
          : t('board_select_cell_first')
      "
      class="btn-primary-action min-h-12 cursor-pointer whitespace-nowrap rounded-xl px-6 py-2 text-base font-semibold shadow-strong"
      :data-testid="TEST_IDS.placeTile"
      @click="emit('place-tile', localCurrentTile, hoveredTile)"
    >
      {{ t('board_place') }}
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
import { t } from '@/utils/i18n'

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
