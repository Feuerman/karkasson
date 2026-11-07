<template>
  <div
    v-if="view.overlay"
    class="fixed inset-0 z-[10000] flex items-center justify-center bg-overlay/80 p-6 text-text backdrop-blur-[2px]"
    :data-testid="TEST_IDS.connectionOverlay"
    role="alert"
    aria-live="assertive"
  >
    <div class="panel-parchment w-full max-w-md p-6 text-center shadow-soft">
      <UIcon
        :name="icon"
        class="mx-auto h-10 w-10"
        :class="[toneClass, { 'animate-spin': isSpinning }]"
      />
      <p class="mt-3 text-lg font-semibold">{{ view.label }}</p>
      <p v-if="view.details" class="mt-1 text-sm text-text-muted">
        {{ view.details }}
      </p>
      <UButton
        v-if="view.canRetry"
        color="primary"
        class="mt-4"
        :data-testid="TEST_IDS.connectionRetry"
        @click="emit('retry')"
      >
        Переподключиться
      </UButton>
    </div>
  </div>

  <div
    v-else
    class="fixed right-4 top-4 z-[3001]"
    :data-testid="TEST_IDS.connectionStatus"
    aria-live="polite"
  >
    <UBadge
      :color="view.tone"
      variant="subtle"
      class="rounded-pill border border-secondary-dark/40 bg-surface/95 px-4 py-2 text-text-muted shadow-soft"
    >
      <template #leading>
        <UIcon :name="icon" class="h-4 w-4" :class="toneClass" />
      </template>
      {{ view.label }}
    </UBadge>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import { TEST_IDS } from '@/data/testIds'
import type { ConnectionStatusView } from '@/modules/connectionStatus'

const props = defineProps<{
  view: ConnectionStatusView
}>()

const emit = defineEmits<{
  retry: []
}>()

const icon = computed(() => {
  if (props.view.tone === 'success') return 'i-lucide-circle-check'
  if (props.view.tone === 'warning') return 'i-lucide-loader-circle'
  return 'i-lucide-wifi-off'
})

const toneClass = computed(() => {
  if (props.view.tone === 'success') return 'text-success'
  if (props.view.tone === 'warning') return 'text-warning'
  return 'text-danger'
})

const isSpinning = computed(() => props.view.tone === 'warning')
</script>
