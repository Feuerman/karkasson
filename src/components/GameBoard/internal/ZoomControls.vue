<template>
  <div
    v-if="!showLobby"
    class="fixed bottom-4 right-4 z-[3000] flex items-center gap-1 rounded-card border border-secondary-dark bg-surface/90 p-1 shadow-strong backdrop-blur"
  >
    <UButton
      color="primary"
      icon="i-lucide-zoom-out"
      :title="t('board_zoom_out')"
      :aria-label="t('board_zoom_out_aria')"
      class="btn-secondary h-8 w-8 cursor-pointer !p-0"
      :ui="{ leadingIcon: 'size-4' }"
      :data-testid="TEST_IDS.zoomOut"
      @click="zoomOut"
    />
    <button
      type="button"
      :title="t('board_zoom_reset')"
      class="min-w-[3.25rem] cursor-pointer rounded-md px-1 py-0.5 text-sm font-semibold tabular-nums text-tertiary transition-colors hover:bg-secondary/20"
      :data-testid="TEST_IDS.zoomValue"
      @click="resetZoom"
    >
      {{ zoomPercent }}%
    </button>
    <UButton
      color="primary"
      icon="i-lucide-zoom-in"
      :title="t('board_zoom_in')"
      :aria-label="t('board_zoom_in_aria')"
      class="btn-secondary h-8 w-8 cursor-pointer !p-0"
      :ui="{ leadingIcon: 'size-4' }"
      :data-testid="TEST_IDS.zoomIn"
      @click="zoomIn"
    />
  </div>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import { TEST_IDS } from '@/data/testIds'
import { t } from '@/utils/i18n'

defineProps<{
  showLobby: boolean
  zoomPercent: number
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
}>()
</script>
