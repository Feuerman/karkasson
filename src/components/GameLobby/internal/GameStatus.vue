<template>
  <div
    v-if="game.gameIsStarted && !game.gameIsEnded"
    class="flex items-center gap-1.5 text-body text-text-surface"
  >
    <UIcon
      name="i-lucide-footprints"
      class="h-[18px] w-[18px] text-secondary"
    />
    Раунд {{ game.moveCounter }}
  </div>
  <div
    v-else-if="game.gameIsEnded"
    class="flex items-center gap-1.5 text-body text-text-surface"
  >
    <UIcon name="i-lucide-trophy" class="h-[18px] w-[18px] text-secondary" />
    Окончена
  </div>
  <div v-else class="flex items-center gap-1.5 text-body text-text-surface">
    <UIcon name="i-lucide-hourglass" class="h-[18px] w-[18px] text-secondary" />
    Ожидание игроков
  </div>
</template>

<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'
import type { LobbyGame } from '@/types/game'

defineProps<{
  game: LobbyGame
}>()
</script>
