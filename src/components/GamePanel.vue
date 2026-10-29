<template>
  <Draggable
    :draggable-id="draggableId"
    :initial-x="initialX"
    :initial-y="initialY"
    :right-offset="rightOffset"
    :drag-enabled="dragEnabled"
  >
    <div class="panel-parchment text-text shadow-card" :class="surfaceClass">
      <div
        v-if="icon || title"
        class="flex items-center gap-2"
        :class="collapsed ? '' : 'mb-2.5'"
      >
        <UIcon v-if="icon" :name="icon" class="h-5 w-5 text-secondary-dark" />
        <span v-if="title" class="title-medieval text-body leading-none">
          {{ title }}
        </span>
        <PanelCollapseButton
          :panel-id="draggableId"
          :collapsed="collapsed"
          class="ml-auto"
          @toggle="toggle"
        />
      </div>
      <slot name="header" :collapsed="collapsed" :toggle="toggle" />
      <div v-show="!collapsed">
        <slot />
      </div>
    </div>
  </Draggable>
</template>

<script setup lang="ts">
import Draggable from './Draggable.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import PanelCollapseButton from './PanelCollapseButton.vue'

withDefaults(
  defineProps<{
    draggableId: string
    /** Окно свёрнуто: показывается только заголовок. */
    collapsed: boolean
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

const emit = defineEmits<{
  toggle: []
}>()

/** Просьба свернуть или развернуть окно. */
const toggle = () => {
  emit('toggle')
}
</script>
