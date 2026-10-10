<template>
  <p class="text-center text-sm text-text-muted" :data-testid="testId">
    {{ label }}:
    <strong class="text-text">{{
      enabled ? enabledText : disabledText
    }}</strong>
  </p>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  enabled: boolean
  enabledText: string
  disabledText: string
  testId?: string
}>()
</script>
