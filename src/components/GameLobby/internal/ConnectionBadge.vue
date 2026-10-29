<template>
  <div class="fixed right-4 top-4 z-[3001] flex items-center gap-2">
    <UBadge
      :color="isConnected ? 'success' : 'error'"
      variant="subtle"
      class="rounded-pill border border-secondary-dark/40 bg-surface/95 px-4 py-2 text-text-muted shadow-soft"
    >
      <template #leading>
        <span
          class="h-2.5 w-2.5 rounded-full transition-colors duration-300"
          :class="
            isConnected ? 'bg-status-connected' : 'bg-status-disconnected'
          "
        ></span>
      </template>
      {{ isConnected ? 'Подключено' : 'Отключено' }}
    </UBadge>
  </div>
</template>

<script setup lang="ts">
import UBadge from '@nuxt/ui/components/Badge.vue'

defineProps<{
  isConnected: boolean
}>()
</script>
