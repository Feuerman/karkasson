<template>
  <Draggable draggable-id="tiles-list">
    <div class="grid w-[500px] grid-cols-15">
      <div
        v-for="tile in tiles"
        :key="tile.id"
        class="mb-5 w-[110px]"
        :class="{
          'opacity-50': tile.count - (currentTilesCount[tile.id] || 0) === 0,
        }"
      >
        <div class="mb-1 text-center text-xl font-bold text-black">
          {{ tile.count - (currentTilesCount[tile.id] || 0) }}
        </div>
        <TileView :tile="tile" />
      </div>
    </div>
  </Draggable>
</template>
<script setup lang="ts">
import Draggable from '@/components/Draggable.vue'
import { tiles } from '@server/data/tiles'
import TileView from '@/components/TileView.vue'
import type { IGameBoard } from '@/types/game'
import { computed } from 'vue'

const props = defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})

const currentTilesCount = computed(() => {
  return (
    props.gameBoard?.tileHistory?.reduce<Record<string, number>>(
      (acc, tile) => {
        acc[tile.id] = acc[tile.id] ? acc[tile.id] + 1 : 1
        return acc
      },
      {}
    ) || {}
  )
})
</script>
