<template>
  <span
    class="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary-soft px-2 py-0.5 font-bold tabular-nums text-primary underline-offset-2 transition-opacity hover:opacity-80 active:no-underline"
    :title="`Строка ${row}, столбец ${col}`"
    @click="emit('zoom', row, col)"
  >
    <span>{{ row }}</span>
    <span aria-hidden="true" class="text-primary/50">·</span>
    <span>{{ col }}</span>
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
