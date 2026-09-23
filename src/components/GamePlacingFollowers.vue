<template>
  <Draggable
    v-if="gameBoard.isPlacingFollower"
    draggable-id="placing-followers"
    :initial-x="700"
    :initial-y="400"
  >
    <div
      class="panel-parchment min-w-[220px] max-w-[300px] p-4 text-text shadow-card"
    >
      <div class="mb-2.5 flex items-center gap-2">
        <UIcon name="i-lucide-person-standing" class="h-5 w-5 text-gold-dark" />
        <span class="title-medieval text-[1rem] leading-none">
          Поставить подданного
        </span>
      </div>
      <div
        v-if="gameBoard.availableFollowersPlaces.length === 0"
        class="flex flex-col gap-2"
      >
        <div class="mb-1 text-text-muted">Нет доступных клеток</div>
        <UButton
          block
          variant="soft"
          color="neutral"
          class="cursor-pointer font-semibold"
          @click="gameBoard.isMyTurn && GameService.skipFollower"
        >
          Отменить
        </UButton>
      </div>
      <div v-else class="flex flex-col gap-1.5">
        <UButton
          v-for="(place, index) in gameBoard.availableFollowersPlaces"
          :key="index"
          block
          variant="ghost"
          class="cursor-pointer justify-start gap-2 rounded-lg font-semibold text-text hover:bg-surface-soft"
          @click.stop="gameBoard.isMyTurn && GameService.placeFollower(place)"
        >
          <template #leading>
            <UIcon :name="placeIcon(place)" class="h-4 w-4 text-gold-dark" />
          </template>
          <template v-if="place.temporaryObject?.isMonastery"
            >Монастырь</template
          >
          <template v-else>
            {{ pointTypeTitle(place.point.pointType) }}
            {{ pointDirectionTitle(place.point.direction) }}
          </template>
        </UButton>
      </div>
    </div>
  </Draggable>
</template>

<script setup lang="ts">
import type { IGameBoard } from '@/types/game'
import Draggable from '@/components/Draggable.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import GameService from '@/modules/GameService'
import {
  followerPlaceIcon as placeIcon,
  pointDirectionTitle,
  pointTypeTitle,
} from '@/utils/labels'

defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})
</script>
