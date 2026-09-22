<template>
  <div class="flex flex-col gap-2">
    <template v-if="isOpened">
      <slot />
    </template>
    <button
      class="cursor-pointer rounded-lg border-0 bg-surface-muted px-4 py-1.5 text-sm font-medium text-text transition-all duration-200 hover:bg-border"
      @click="isOpened = !isOpened"
    >
      {{ !isOpened ? 'Показать' : 'Скрыть' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isOpened = ref(false)
</script>
