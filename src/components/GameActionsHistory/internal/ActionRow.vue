<template>
  <div
    class="mb-0.5 flex items-start gap-1.5 rounded-lg px-1.5 py-1 transition-colors duration-150 hover:bg-surface-soft"
  >
    <span
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-muted text-gold-dark ring-1 ring-border"
    >
      <UIcon :name="icon" class="h-3.5 w-3.5" />
    </span>
    <div
      class="flex flex-wrap items-center gap-x-1 text-[.92rem] leading-6 [&_span+span]:ml-0.5"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'

defineProps<{
  icon: string
}>()
</script>
