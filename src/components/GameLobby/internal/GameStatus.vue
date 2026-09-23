<template>
  <div
    v-if="game.gameIsStarted && !game.gameIsEnded"
    class="flex items-center gap-1.5 text-[1.05rem] text-[#d9c9a3]"
  >
    <UIcon name="i-lucide-footprints" class="h-[18px] w-[18px] text-gold" />
    Ход {{ game.moveCounter }}
  </div>
  <div
    v-else-if="game.gameIsEnded"
    class="flex items-center gap-1.5 text-[1.05rem] text-[#d9c9a3]"
  >
    <UIcon name="i-lucide-trophy" class="h-[18px] w-[18px] text-gold" />
    Окончена
  </div>
  <div v-else class="flex items-center gap-1.5 text-[1.05rem] text-[#d9c9a3]">
    <UIcon name="i-lucide-hourglass" class="h-[18px] w-[18px] text-gold" />
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
