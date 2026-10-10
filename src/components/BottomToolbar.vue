<template>
  <div class="fixed bottom-4 left-4 z-[9998] flex items-center gap-2">
    <GameMenu :items="items" @select="emit('select', $event)" />
    <UButton
      v-if="!showLobby"
      color="primary"
      :icon="layoutEditMode ? 'i-lucide-check' : 'i-lucide-panels-top-left'"
      :aria-pressed="layoutEditMode"
      :aria-label="
        layoutEditMode ? 'Завершить настройку окон' : 'Настроить окна'
      "
      class="btn-primary-action min-h-11 shrink-0 cursor-pointer gap-2 rounded-full px-3 font-semibold shadow-soft sm:px-4"
      @click="emit('toggleLayoutEdit')"
    >
      <span class="hidden sm:inline">
        {{ layoutEditMode ? 'Готово' : 'Настроить окна' }}
      </span>
    </UButton>
    <UButton
      v-if="!showLobby"
      color="primary"
      icon="i-lucide-arrow-left"
      :data-testid="TEST_IDS.gameExit"
      aria-label="Выйти из игры"
      title="Выйти из игры"
      class="btn-primary-action min-h-11 shrink-0 cursor-pointer gap-2 rounded-full px-3 font-semibold shadow-soft sm:px-4"
      @click="emit('exit')"
    >
      <span class="hidden sm:inline">Выйти из игры</span>
    </UButton>
  </div>
</template>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import GameMenu, { type GameMenuItem } from './GameMenu.vue'
import { TEST_IDS } from '@/data/testIds'

defineProps<{
  items: GameMenuItem[]
  showLobby: boolean
  layoutEditMode: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  toggleLayoutEdit: []
  exit: []
}>()
</script>
