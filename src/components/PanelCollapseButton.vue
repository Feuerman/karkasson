<template>
  <UButton
    size="xs"
    color="neutral"
    variant="ghost"
    :icon="collapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
    :aria-label="collapsed ? expandLabel : collapseLabel"
    :aria-expanded="!collapsed"
    :data-testid="testId"
    class="h-7 w-7 cursor-pointer justify-center p-0"
    @click="emit('toggle')"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { TEST_IDS } from '@/data/testIds'

const props = withDefaults(
  defineProps<{
    /** Идентификатор окна: кнопка ищется по нему в тестах. */
    panelId: string
    /** Окно свёрнуто: кнопка разворачивает его. */
    collapsed: boolean
    /** Подпись кнопки, когда окно свёрнуто. */
    expandLabel?: string
    /** Подпись кнопки, когда окно развёрнуто. */
    collapseLabel?: string
  }>(),
  {
    expandLabel: 'Развернуть окно',
    collapseLabel: 'Свернуть окно',
  }
)

const emit = defineEmits<{
  toggle: []
}>()

/** Идентификатор кнопки: у каждого окна он свой. */
const testId = computed(() => `${TEST_IDS.panelCollapse}-${props.panelId}`)
</script>
