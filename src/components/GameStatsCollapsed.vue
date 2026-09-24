<template>
  <div class="flex flex-col gap-2">
    <template v-if="isOpened">
      <slot />
    </template>
    <UButton
      size="sm"
      variant="soft"
      color="neutral"
      class="btn-secondary min-h-9 self-start rounded-lg px-4 py-1.5 font-medium"
      @click="isOpened = !isOpened"
    >
      {{ !isOpened ? 'Показать' : 'Скрыть' }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

const isOpened = ref(false)
</script>
