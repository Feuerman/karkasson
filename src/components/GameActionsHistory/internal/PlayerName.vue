<template>
  <span :class="playerTextColorClass(color)"><slot /></span>
</template>

<script setup lang="ts">
import { playerTextColorClass } from '@/utils/colors'

defineProps<{
  color?: string | null
}>()
</script>