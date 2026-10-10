<template>
  <Draggable
    :draggable-id="draggableId"
    :initial-x="initialX"
    :initial-y="initialY"
    :right-offset="rightOffset"
    :drag-enabled="dragEnabled"
  >
    <div class="panel-parchment text-text shadow-card" :class="surfaceClass">
      <div v-if="icon && title" class="mb-2.5 flex items-center gap-2">
        <UIcon :name="icon" class="h-5 w-5 text-gold-dark" />
        <span class="title-medieval text-[1rem] leading-none">
          {{ title }}
        </span>
      </div>
      <slot name="header" />
      <slot />
    </div>
  </Draggable>
</template>

<script setup lang="ts">
import Draggable from './Draggable.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

withDefaults(
  defineProps<{
    draggableId: string
    initialX?: number
    initialY?: number
    rightOffset?: number
    dragEnabled?: boolean
    icon?: string
    title?: string
    surfaceClass?: string
  }>(),
  {
    initialX: 0,
    initialY: 0,
    rightOffset: undefined,
    dragEnabled: false,
    icon: undefined,
    title: undefined,
    surfaceClass: undefined,
  }
)
</script>
