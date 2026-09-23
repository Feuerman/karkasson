<template>
  <div
    class="mb-1 flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-surface-soft"
  >
    <span
      class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-gold-dark ring-1 ring-border"
    >
      <UIcon :name="icon" class="h-4 w-4" />
    </span>
    <div
      class="flex flex-wrap items-center gap-x-1 text-[0.95rem] leading-snug [&_span+span]:ml-0.5"
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