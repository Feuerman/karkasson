<template>
  <div
    class="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-black/80 text-lg font-medium text-white"
  >
    <div class="flex flex-col items-center gap-2.5">
      <UIcon
        name="i-lucide-loader-circle"
        class="h-10 w-10 animate-spin text-white"
      />
      <div>{{ t('connection_waiting_players') }}</div>
    </div>
    <div class="flex flex-wrap justify-center gap-2.5">
      <UBadge
        v-for="player in players"
        :key="player.id"
        variant="subtle"
        class="!bg-white/20 !text-white"
      >
        {{ player.name }}
      </UBadge>
    </div>
  </div>
</template>

<script setup lang="ts">
import UBadge from '@nuxt/ui/components/Badge.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import { t } from '@/utils/i18n'
import type { PlayerView } from '@server/modules/types'

defineProps<{
  players: PlayerView[]
}>()
</script>
