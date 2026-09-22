<template>
  <Draggable
    v-if="gameBoard.isPlacingFollower"
    draggable-id="placing-followers"
    class="min-w-[200px] rounded-lg bg-surface p-4 shadow-card"
    :initial-x="700"
    :initial-y="400"
  >
    <template v-if="gameBoard.availableFollowersPlaces.length === 0">
      <div class="mb-2 text-text">Нет доступных клеток</div>
      <button
        class="w-full cursor-pointer rounded-lg border-0 bg-surface-muted px-3 py-2 font-medium text-text transition-all duration-200 hover:bg-border disabled:cursor-not-allowed disabled:bg-disabled"
        @click="gameBoard.isMyTurn && GameService.skipFollower"
      >
        Отменить
      </button>
    </template>
    <template v-else>
      <div
        v-for="(place, index) in gameBoard.availableFollowersPlaces"
        :key="index"
        class="mb-1 cursor-pointer rounded-lg p-3 text-center transition-all duration-200 last:mb-0 hover:bg-surface-muted"
        @click.stop="gameBoard.isMyTurn && GameService.placeFollower(place)"
      >
        <template v-if="place.temporaryObject?.isMonastery">Монастырь</template>
        <template v-else>
          {{ pointTypeTitle(place.point.pointType) }}
          {{ pointDirectionTitle(place.point.direction) }}
        </template>
      </div>
    </template>
  </Draggable>
</template>

<script setup lang="ts">
import { type IGameBoard } from '../../server/src/modules/GameManager.ts'
import Draggable from '@/components/Draggable.vue'
import GameService from '@/modules/GameService.js'

defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})

const pointTypeTitle = (pointType: any) => {
  const pointTypeMap = {
    city: 'Город',
    road: 'Дорога',
    field: 'Поле',
    monastery: 'Монастырь',
  }

  return pointTypeMap[pointType]
}

const pointDirectionTitle = (direction: any) => {
  const directionMap = {
    north: 'Север',
    south: 'Юг',
    east: 'Восток',
    west: 'Запад',
  }

  return directionMap[direction]
}
</script>
