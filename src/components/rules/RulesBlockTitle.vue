<template>
  <div v-if="title" class="text-[17px] font-semibold text-text" :class="spaced">
    {{ title }}
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    /** Отступ снизу под содержимое блока. */
    spaced?: string
  }>(),
  {
    title: undefined,
    spaced: 'mb-1.5',
  }
)
</script>
