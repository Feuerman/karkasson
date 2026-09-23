<template>
  <span
    class="cursor-pointer rounded-md bg-primary-soft px-1.5 font-bold text-primary underline-offset-2 transition-opacity hover:opacity-80 active:no-underline"
    @click="emit('zoom', row, col)"
  >
    {{ row }}
    {{ col }}
  </span>
</template>

<script setup lang="ts">
const { row, col } = defineProps<{
  row: number
  col: number
}>()

const emit = defineEmits<{
  zoom: [row: number, col: number]
}>()
</script>