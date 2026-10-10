<template>
  <div class="space-y-2">
    <UCheckbox
      :label="label"
      color="primary"
      :data-testid="testId"
      :model-value="modelValue"
      :ui="{ label: '!text-base' }"
      class="text-base text-text items-center"
      @update:model-value="emit('update:modelValue', Boolean($event))"
    />
    <p class="text-sm leading-relaxed text-text-muted">
      {{ description }}
    </p>
  </div>
</template>

<script setup lang="ts">
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'

withDefaults(
  defineProps<{
    label: string
    description: string
    modelValue: boolean
    testId?: string
  }>(),
  {
    testId: undefined,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>
