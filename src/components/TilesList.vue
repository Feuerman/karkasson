<template>
  <Draggable draggable-id="tiles-list">
    <div class="game-all-tiles">
      <div
        v-for="tile in tiles"
        :key="tile.id"
        class="game-all-tiles__tile"
        :class="{
          '--disabled': tile.count - (currentTilesCount[tile.id] || 0) === 0,
        }"
      >
        <div class="game-all-tiles__tile__count">
          {{ tile.count - (currentTilesCount[tile.id] || 0) }}
        </div>
        <TileView :tile="tile" />
      </div>
    </div>
  </Draggable>
</template>
<script setup lang="ts">
import Draggable from '@/components/Draggable.vue'
import tiles from '../../server/src/data/tiles.js'
import TileView from '@/components/TileView.vue'
import { type IGameBoard } from '../../server/src/modules/GameManager.ts'
import { computed } from 'vue'

const props = defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})

const currentTilesCount = computed(() => {
  return (
    props.gameBoard?.tileHistory?.reduce((acc, tile) => {
      acc[tile.id] = acc[tile.id] ? acc[tile.id] + 1 : 1
      return acc
    }, {}) || {}
  )
})
</script>

<style scoped lang="scss">
.game-all-tiles {
  display: grid;
  grid-template-columns: repeat(15, 1fr);
  width: 500px;

  &__tile {
    width: 110px;
    margin-bottom: 20px;

    &.--disabled {
      opacity: 0.5;
    }
  }

  &__tile__count {
    color: #000;
    font-size: 20px;
    text-align: center;
    margin-bottom: 5px;
    font-weight: bold;
  }
}
</style>
