<template>
  <div>
    <p
      v-if="block.type === 'paragraph'"
      class="mb-3 text-[15px] leading-relaxed text-text"
    >
      <span v-if="block.title" class="font-semibold text-text">
        {{ block.title }}.
      </span>
      {{ block.text }}
    </p>

    <div v-else-if="block.type === 'list'" class="mb-3">
      <div v-if="block.title" class="mb-1 font-semibold text-text">
        {{ block.title }}
      </div>
      <ul
        v-if="block.ordered !== true"
        class="list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-text"
      >
        <li v-for="(item, index) in block.items" :key="index">{{ item }}</li>
      </ul>
      <ol
        v-else
        class="list-decimal space-y-1 pl-5 text-[15px] leading-relaxed text-text"
      >
        <li v-for="(item, index) in block.items" :key="index">{{ item }}</li>
      </ol>
    </div>

    <UAlert
      v-else-if="block.type === 'callout'"
      class="mb-3"
      variant="subtle"
      :color="calloutColor(block.tone)"
      :icon="calloutIcon(block.tone)"
      :title="block.title"
      :description="block.text"
    />

    <div v-else-if="block.type === 'table'" class="mb-3">
      <div v-if="block.title" class="mb-1 font-semibold text-text">
        {{ block.title }}
      </div>
      <UTable
        :columns="tableColumns"
        :data="tableRows"
        class="rounded-lg border border-border"
      />
    </div>

    <RulesExampleGrid
      v-else-if="block.type === 'example'"
      class="mb-3"
      :example="block"
    />

    <div v-else-if="block.type === 'tiles-row'" class="mb-3">
      <div v-if="block.title" class="mb-1.5 font-semibold text-text">
        {{ block.title }}
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <div
          v-for="(tile, index) in block.tiles"
          :key="index"
          class="flex w-[88px] flex-col items-center gap-1"
        >
          <TileView :tile="tile" :size="88" :followers="[]" />
          <span
            v-if="block.labels?.[index]"
            class="text-center text-xs leading-tight text-text-muted"
          >
            {{ block.labels[index] }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TileView from '@/components/TileView.vue'
import RulesExampleGrid from './RulesExampleGrid.vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UTable from '@nuxt/ui/components/Table.vue'
import type { RulesBlock, RulesCalloutTone } from '@/rules/types'

const props = defineProps({
  block: {
    type: Object as () => RulesBlock,
    required: true,
  },
})

type CalloutColor = 'success' | 'warning' | 'primary'

const calloutColor = (tone: RulesCalloutTone): CalloutColor => {
  switch (tone) {
    case 'tip':
      return 'success'
    case 'warning':
      return 'warning'
    default:
      return 'primary'
  }
}

const calloutIcon = (tone: RulesCalloutTone): string => {
  switch (tone) {
    case 'tip':
      return 'i-lucide-lightbulb'
    case 'warning':
      return 'i-lucide-triangle-alert'
    default:
      return 'i-lucide-info'
  }
}

const tableBlock = computed(() => {
  if (props.block.type !== 'table') return null
  return props.block
})

const tableColumns = computed(() => {
  return (
    tableBlock.value?.head.map((head, index) => ({
      key: `col${index}`,
      header: head,
    })) ?? []
  )
})

const tableRows = computed(() => {
  return (
    tableBlock.value?.rows.map((row) =>
      Object.fromEntries(row.map((value, index) => [`col${index}`, value]))
    ) ?? []
  )
})
</script>
