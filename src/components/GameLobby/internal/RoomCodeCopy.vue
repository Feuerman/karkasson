<template>
  <div class="flex justify-center">
    <button
      type="button"
      class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gold-dark/40 bg-surface/70 px-3 py-1.5 text-sm font-medium text-text-muted transition-colors hover:bg-gold/15"
      :title="copied ? 'Номер скопирован' : 'Скопировать номер комнаты'"
      :data-testid="testId"
      @click="copy"
    >
      <UIcon
        :name="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        class="h-4 w-4"
      />
      {{ copied ? 'Номер скопирован' : 'Скопировать номер' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'

const props = withDefaults(
  defineProps<{
    roomCode?: string
    testId?: string
  }>(),
  { testId: undefined }
)

const { copied, copy: copyToClipboardFn } = useCopyToClipboard()

const copy = async () => {
  await copyToClipboardFn(props.roomCode ?? '')
}
</script>
