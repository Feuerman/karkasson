<template>
  <div class="flex flex-col items-center justify-center gap-4 rounded-lg p-8">
    <UIcon
      name="i-lucide-loader-circle"
      class="h-10 w-10 animate-spin text-gold-dark"
    />
    <p class="m-0 text-center text-[1.2rem] text-text-muted">
      {{ message }}
    </p>
  </div>
</template>

<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'

defineProps<{
  message: string
}>()
</script>
