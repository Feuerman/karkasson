<template>
  <UButton
    size="xs"
    color="neutral"
    variant="ghost"
    :icon="collapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
    :aria-label="collapsed ? resolvedExpandLabel : resolvedCollapseLabel"
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
import { t } from '@/utils/i18n'

const props = defineProps<{
  /** Идентификатор окна: кнопка ищется по нему в тестах. */
  panelId: string
  /** Окно свёрнуто: кнопка разворачивает его. */
  collapsed: boolean
  /** Подпись кнопки, когда окно свёрнуто. */
  expandLabel?: string
  /** Подпись кнопки, когда окно развёрнуто. */
  collapseLabel?: string
}>()

const emit = defineEmits<{
  toggle: []
}>()

const resolvedExpandLabel = computed(
  () => props.expandLabel ?? t('panel_expand')
)
const resolvedCollapseLabel = computed(
  () => props.collapseLabel ?? t('panel_collapse')
)

/** Идентификатор кнопки: у каждого окна он свой. */
const testId = computed(() => `${TEST_IDS.panelCollapse}-${props.panelId}`)
</script>
