<template>
  <div class="flex justify-center gap-1">
    <UButton
      v-for="tab in tabs"
      :key="tab.value"
      :class="[
        'flex-1 max-w-md text-center',
        activeTab === tab.value
          ? 'bg-primary text-white'
          : 'bg-surface-50 text-text-muted hover:bg-surface-100',
      ]"
      variant="outline"
      size="sm"
      @click="emit('update:activeTab', tab.value)"
    >
      {{ t(tab.labelKey) }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/utils/i18n'
import type { AccountTab } from '@/types/socket'
import UButton from '@nuxt/ui/components/Button.vue'

type TabConfig = {
  value: AccountTab
  labelKey: string
}

defineProps<{
  tabs: TabConfig[]
  activeTab: AccountTab
}>()

const emit = defineEmits<{
  'update:activeTab': [value: AccountTab]
}>()
</script>
