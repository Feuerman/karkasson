<template>
  <Draggable
    v-if="gameBoard.isPlacingFollower"
    draggable-id="placing-followers"
    :initial-x="700"
    :initial-y="400"
  >
    <UCard
      class="min-w-[200px] shadow-card"
      :ui="{ root: 'rounded-lg', body: 'p-4' }"
    >
      <div
        v-if="gameBoard.availableFollowersPlaces.length === 0"
        class="flex flex-col gap-2"
      >
        <div class="mb-2 text-text">Нет доступных клеток</div>
        <UButton
          block
          variant="soft"
          color="neutral"
          class="font-medium"
          @click="gameBoard.isMyTurn && GameService.skipFollower"
        >
          Отменить
        </UButton>
      </div>
      <div v-else class="flex flex-col gap-1">
        <UButton
          v-for="(place, index) in gameBoard.availableFollowersPlaces"
          :key="index"
          block
          variant="ghost"
          class="rounded-lg text-center"
          @click.stop="gameBoard.isMyTurn && GameService.placeFollower(place)"
        >
          <template v-if="place.temporaryObject?.isMonastery"
            >Монастырь</template
          >
          <template v-else>
            {{ pointTypeTitle(place.point.pointType) }}
            {{ pointDirectionTitle(place.point.direction) }}
          </template>
        </UButton>
      </div>
    </UCard>
  </Draggable>
</template>

<script setup lang="ts">
import type { IGameBoard } from '@/types/game'
import type { PointType, PointDirection } from '@server/modules/types'
import Draggable from '@/components/Draggable.vue'
import UCard from '@nuxt/ui/components/Card.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import GameService from '@/modules/GameService'

defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})

const pointTypeTitle = (pointType?: PointType | 'monastery') => {
  const pointTypeMap: Record<string, string> = {
    city: 'Город',
    road: 'Дорога',
    field: 'Поле',
    monastery: 'Монастырь',
  }

  return pointTypeMap[pointType ?? '']
}

const pointDirectionTitle = (direction?: PointDirection) => {
  const directionMap: Record<string, string> = {
    north: 'Север',
    south: 'Юг',
    east: 'Восток',
    west: 'Запад',
    center: 'Центр',
  }

  return directionMap[direction ?? '']
}
</script>
