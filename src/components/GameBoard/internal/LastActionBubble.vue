<template>
  <span
    v-if="isVisible"
    :data-testid="TEST_IDS.boardLastActionBubble"
    class="last-action-bubble pointer-events-none absolute -top-2 -right-2 z-20 rounded-full px-1.5 py-0.5 text-xs font-bold text-black shadow-strong ring-2 ring-white/70"
    :class="colorClass"
  >
    +{{ points }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TEST_IDS } from '@/data/testIds'
import { playerBackgroundColorClass } from '@/utils/colors'

const props = defineProps<{
  isVisible: boolean
  points: number
  color: string | null
}>()

const colorClass = computed(() => playerBackgroundColorClass(props.color))
</script>
