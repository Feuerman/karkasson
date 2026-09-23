<template>
  <div class="rounded-xl border border-border bg-surface-soft p-3.5">
    <div class="mb-1.5 text-[16px] font-semibold text-text">
      {{ example.title }}
    </div>
    <p v-if="example.description" class="mb-3 text-[15px] text-text-muted">
      {{ example.description }}
    </p>

    <div
      class="inline-flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-2.5 shadow-soft"
    >
      <div
        v-for="(row, rowIndex) in paddedRows"
        :key="rowIndex"
        class="flex gap-1.5"
      >
        <div
          v-for="(cellEntry, cellIndex) in row"
          :key="cellIndex"
          class="relative"
          :class="['shrink-0 select-none', cellEntry.tile ? '' : 'opacity-0']"
          :style="cellStyle"
        >
          <TileView
            v-if="cellEntry.tile"
            :tile="cellEntry.tile"
            :size="cellPx"
            :followers="[]"
          />

          <span
            v-for="(marker, markerIndex) in cellEntry.tile?.markers ?? []"
            :key="markerIndex"
            class="pointer-events-none absolute z-10"
            :class="markerClasses(marker)"
          >
            <span
              v-if="marker.kind === 'follower'"
              class="block h-4 w-4 rounded-full ring-2 ring-white shadow-soft"
              :class="followerColorClass(marker.color)"
            ></span>
            <span
              v-else-if="marker.kind === 'no'"
              class="flex h-6 w-6 items-center justify-center rounded-full bg-danger text-white ring-2 ring-white shadow-soft"
            >
              <UIcon name="i-lucide-x" class="text-[13px]" />
            </span>
            <span
              v-else-if="marker.kind === 'new'"
              class="absolute inset-0 block rounded-lg border-2 border-dashed border-primary opacity-80"
            ></span>
            <span
              v-else-if="marker.kind === 'completed'"
              class="absolute inset-0 block rounded-lg border-2 border-success shadow-[0_0_10px_rgba(76,175,80,0.55)]"
            ></span>
          </span>
        </div>
      </div>
    </div>

    <p
      v-if="example.caption"
      class="mt-2.5 text-[14px] leading-relaxed text-text-faint"
    >
      {{ example.caption }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TileView from '@/components/TileView.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import type { PointDirection } from '@server/modules/types'
import type { RulesExample, RulesMarker, RulesMarkerColor } from '@/rules/types'

const props = defineProps({
  example: {
    type: Object as () => RulesExample,
    required: true,
  },
})

const maxCols = computed(() => {
  return Math.max(1, ...props.example.grid.map((row) => row.length))
})

const cellPx = computed(() => {
  return Math.max(56, Math.min(96, Math.floor(760 / maxCols.value)))
})

const paddedRows = computed(() => {
  return props.example.grid.map((row) => {
    return [...row, ...Array(maxCols.value - row.length).fill({})]
  })
})

const cellStyle = computed(() => ({
  width: `${cellPx.value}px`,
  height: `${cellPx.value}px`,
}))

const followerColorClass = (color: RulesMarkerColor) => {
  return {
    coral: 'bg-player-coral',
    skyblue: 'bg-player-skyblue',
    gold: 'bg-player-gold',
    teal: 'bg-player-teal',
  }[color]
}

const markerPositionClasses = (direction: PointDirection) => {
  switch (direction) {
    case 'north':
      return 'left-1/2 top-[6px] -translate-x-1/2'
    case 'south':
      return 'bottom-[6px] left-1/2 -translate-x-1/2'
    case 'east':
      return 'right-[4px] top-1/2 -translate-y-1/2'
    case 'west':
      return 'left-[4px] top-1/2 -translate-y-1/2'
    default:
      return 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
  }
}

const markerClasses = (marker: RulesMarker) => {
  if (marker.kind === 'new' || marker.kind === 'completed') {
    return 'left-0 top-0 h-full w-full'
  }
  return markerPositionClasses(marker.direction)
}
</script>
