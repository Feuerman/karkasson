<template>
  <span :class="playerTextColorClass(color)" :title="title" class="font-bold"
    ><slot
  /></span>
</template>

<script setup lang="ts">
import { playerTextColorClass } from '@/utils/colors'

defineProps<{
  color?: string | null
  title?: string
}>()
</script>
