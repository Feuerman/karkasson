<template>
  <div>
    <p
      v-if="block.type === 'paragraph'"
      class="mb-4 text-[17px] leading-relaxed text-text"
    >
      <span v-if="block.title" class="font-semibold text-text">
        {{ block.title }}.
      </span>
      {{ block.text }}
    </p>

    <div v-else-if="block.type === 'list'" class="mb-4">
      <div
        v-if="block.title"
        class="mb-1.5 text-[17px] font-semibold text-text"
      >
        {{ block.title }}
      </div>
      <ul
        v-if="block.ordered !== true"
        class="list-disc space-y-1.5 pl-5 text-[17px] leading-relaxed text-text"
      >
        <li v-for="(item, index) in block.items" :key="index">{{ item }}</li>
      </ul>
      <ol
        v-else
        class="list-decimal space-y-1.5 pl-5 text-[17px] leading-relaxed text-text"
      >
        <li v-for="(item, index) in block.items" :key="index">{{ item }}</li>
      </ol>
    </div>

    <UAlert
      v-else-if="block.type === 'callout'"
      class="mb-4"
      variant="subtle"
      :color="calloutColor(block.tone)"
      :icon="calloutIcon(block.tone)"
      :title="block.title"
      :description="block.text"
      :ui="{ title: 'text-[16px] font-semibold', description: 'text-[16px]' }"
    />

    <div v-else-if="block.type === 'table'" class="mb-4">
      <div v-if="block.title" class="mb-2 text-[17px] font-semibold text-text">
        {{ block.title }}
      </div>
      <div class="overflow-x-auto rounded-xl border border-gold-dark/50">
        <table class="w-full border-collapse text-left">
          <thead>
            <tr class="bg-surface-muted">
              <th
                v-for="(head, index) in block.head"
                :key="index"
                scope="col"
                class="border-b-2 border-gold-dark/50 px-4 py-2.5 text-[16px] font-bold text-text"
              >
                {{ head }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rowIndex) in block.rows"
              :key="rowIndex"
              class="odd:bg-surface-soft/70"
            >
              <td
                v-for="(cell, cellIndex) in row"
                :key="cellIndex"
                class="border-t border-border px-4 py-2.5 text-[16px] text-text"
              >
                {{ cell }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <RulesExampleGrid
      v-else-if="block.type === 'example'"
      class="mb-4"
      :example="block"
    />

    <div v-else-if="block.type === 'tiles-row'" class="mb-4">
      <div
        v-if="block.title"
        class="mb-1.5 text-[17px] font-semibold text-text"
      >
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
            class="text-center text-[13px] leading-tight text-text-muted"
          >
            {{ block.labels[index] }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import TileView from '@/components/TileView.vue'
import RulesExampleGrid from './RulesExampleGrid.vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
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
</script>
