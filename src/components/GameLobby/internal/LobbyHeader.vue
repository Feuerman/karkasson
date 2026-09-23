<template>
  <div
    class="flex flex-col items-center gap-1.5 text-center"
    :class="size === 'lg' ? 'mb-5' : 'mb-6'"
  >
    <div
      class="title-medieval mb-2 flex items-center justify-center rounded-2xl border-2 border-gold-dark bg-gradient-to-br from-[#6b4c26] to-[#43301a] shadow-soft"
      :class="size === 'lg' ? 'h-16 w-16' : 'h-14 w-14'"
    >
      <UIcon
        :name="icon"
        class="text-gold"
        :class="size === 'lg' ? 'h-8 w-8' : 'h-7 w-7'"
      />
    </div>
    <component
      :is="size === 'lg' ? 'h1' : 'h3'"
      class="title-medieval m-0 text-[#5a4125]"
      :class="size === 'lg' ? 'text-[2.4rem] leading-none' : 'text-2xl'"
    >
      {{ title }}
    </component>
    <p
      class="m-0 text-text-muted"
      :class="size === 'lg' ? 'text-lg' : 'text-base'"
    >
      {{ subtitle }}
    </p>
  </div>
</template>

<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'

withDefaults(
  defineProps<{
    icon: string
    title: string
    subtitle: string
    size?: 'lg' | 'md'
  }>(),
  {
    size: 'lg',
  }
)
</script>
