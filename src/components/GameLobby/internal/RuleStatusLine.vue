<template>
  <p class="text-center text-sm text-text-muted" :data-testid="testId">
    {{ label }}:
    <strong class="text-text">{{
      enabled
        ? (enabledText ?? t('lobby_rule_on'))
        : (disabledText ?? t('lobby_rule_off'))
    }}</strong>
  </p>
</template>

<script setup lang="ts">
import { t } from '@/utils/i18n'

withDefaults(
  defineProps<{
    label: string
    enabled: boolean
    enabledText?: string
    disabledText?: string
    testId?: string
  }>(),
  {
    enabledText: undefined,
    disabledText: undefined,
  }
)
</script>
