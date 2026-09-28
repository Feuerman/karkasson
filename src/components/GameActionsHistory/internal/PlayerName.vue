<template>
  <span :class="playerTextColorClass(color)" class="text-[.95rem] font-bold"
    ><slot
  /></span>
</template>

<script setup lang="ts">
import { playerTextColorClass } from '@/utils/colors'

defineProps<{
  color?: string | null
}>()
</script>
