<template>
  <div class="fixed bottom-4 left-4 z-[9998]">
    <UDropdownMenu
      :items="dropdownItems"
      :content="{ side: 'top', sideOffset: 8, collisionPadding: 8 }"
    >
      <UButton
        color="primary"
        icon="i-lucide-scroll-text"
        label="Меню"
        class="cursor-pointer rounded-full px-5 text-white shadow-soft"
      />
    </UDropdownMenu>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import type { DropdownMenuItem } from '@nuxt/ui/components/DropdownMenu.vue'

export interface GameMenuItem {
  id: string
  label: string
  icon?: string
}

const props = defineProps({
  items: {
    type: Array as () => GameMenuItem[],
    default: () => [],
  },
})

const emit = defineEmits(['select'])

const dropdownItems = computed<DropdownMenuItem[]>(() =>
  props.items.map((item) => ({
    label: item.label,
    icon: item.icon,
    onSelect: () => emit('select', item.id),
  }))
)
</script>
