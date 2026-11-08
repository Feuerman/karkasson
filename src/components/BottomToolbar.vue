<template>
  <div class="fixed bottom-4 left-4 z-[9998] flex items-center gap-2">
    <GameMenu :items="items" @select="emit('select', $event)" />
    <UButton
      v-if="!showLobby"
      color="primary"
      :icon="soundEnabled ? 'i-lucide-volume-2' : 'i-lucide-volume-x'"
      :aria-pressed="soundEnabled"
      :aria-label="soundEnabled ? t('ui_sound_off') : t('ui_sound_on')"
      :title="soundEnabled ? t('ui_sound_off') : t('ui_sound_on')"
      :data-testid="TEST_IDS.soundToggle"
      class="btn-primary-action min-h-11 shrink-0 cursor-pointer gap-2 rounded-full px-3 font-semibold shadow-soft sm:px-4"
      @click="emit('toggleSound')"
    />
    <UButton
      v-if="!showLobby"
      color="primary"
      :icon="layoutEditMode ? 'i-lucide-check' : 'i-lucide-panels-top-left'"
      :aria-pressed="layoutEditMode"
      :aria-label="layoutEditMode ? t('ui_layout_done') : t('ui_layout_edit')"
      class="btn-primary-action min-h-11 shrink-0 cursor-pointer gap-2 rounded-full px-3 font-semibold shadow-soft sm:px-4"
      @click="emit('toggleLayoutEdit')"
    >
      <span class="hidden sm:inline">
        {{ layoutEditMode ? t('ui_layout_done') : t('ui_layout_edit') }}
      </span>
    </UButton>
    <UButton
      v-if="!showLobby && layoutEditMode"
      color="primary"
      icon="i-lucide-rotate-ccw"
      :data-testid="TEST_IDS.resetPanelLayout"
      :aria-label="t('ui_layout_reset_label')"
      :title="t('ui_layout_reset_label')"
      class="btn-primary-action min-h-11 shrink-0 cursor-pointer gap-2 rounded-full px-3 font-semibold shadow-soft sm:px-4"
      @click="emit('resetLayout')"
    >
      <span class="hidden sm:inline">{{ t('ui_layout_reset_label') }}</span>
    </UButton>
    <UButton
      v-if="!showLobby"
      color="primary"
      icon="i-lucide-arrow-left"
      :data-testid="TEST_IDS.gameExit"
      :aria-label="t('ui_exit_game')"
      :title="t('ui_exit_game')"
      class="btn-primary-action min-h-11 shrink-0 cursor-pointer gap-2 rounded-full px-3 font-semibold shadow-soft sm:px-4"
      @click="emit('exit')"
    >
      <span class="hidden sm:inline">{{ t('ui_exit_game') }}</span>
    </UButton>
  </div>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import GameMenu, { type GameMenuItem } from './GameMenu.vue'
import { t } from '@/utils/i18n'
import { TEST_IDS } from '@/data/testIds'

defineProps<{
  items: GameMenuItem[]
  showLobby: boolean
  layoutEditMode: boolean
  soundEnabled: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  toggleLayoutEdit: []
  resetLayout: []
  toggleSound: []
  exit: []
}>()
</script>
