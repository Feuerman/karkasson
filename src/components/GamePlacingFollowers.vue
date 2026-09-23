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
        <template v-for="(place, index) in gameBoard.availableFollowersPlaces">
          <div
            v-if="
              place.temporaryObject?.isMonastery ||
              place.temporaryObject?.isGarden
            "
            :key="`${index}-monastery`"
            class="flex flex-col gap-1.5"
          >
            <UButton
              v-if="place.temporaryObject?.isMonastery"
              block
              variant="ghost"
              class="cursor-pointer justify-start gap-2 rounded-lg font-semibold text-text hover:bg-surface-soft"
              :disabled="!gameBoard.isMyTurn || ordinaryAvailable === 0"
              @click.stop="
                gameBoard.isMyTurn && placeFollower(place, 'follower')
              "
            >
              <template #leading>
                <UIcon
                  name="i-lucide-person-standing"
                  class="h-4 w-4 text-gold-dark"
                />
              </template>
              Монастырь — монах
            </UButton>
            <UButton
              block
              variant="ghost"
              class="cursor-pointer justify-start gap-2 rounded-lg font-semibold text-text hover:bg-surface-soft"
              :disabled="!gameBoard.isMyTurn || abbotAvailable === 0"
              @click.stop="gameBoard.isMyTurn && placeFollower(place, 'abbot')"
            >
              <template #leading>
                <UIcon
                  :name="
                    place.temporaryObject?.isGarden
                      ? 'i-lucide-flower-2'
                      : 'i-lucide-church'
                  "
                  class="h-4 w-4 text-gold-dark"
                />
              </template>
              {{ centerFeatureTitle(place) }} — аббат
            </UButton>
          </div>
          <UButton
            v-else
            :key="`${index}-ordinary`"
            block
            variant="ghost"
            class="cursor-pointer justify-start gap-2 rounded-lg font-semibold text-text hover:bg-surface-soft"
            :disabled="!gameBoard.isMyTurn || ordinaryAvailable === 0"
            @click.stop="gameBoard.isMyTurn && placeFollower(place, 'follower')"
          >
            <template #leading>
              <UIcon :name="placeIcon(place)" class="h-4 w-4 text-gold-dark" />
            </template>
            {{ pointTypeTitle(place.point.pointType) }}
            {{ pointDirectionTitle(place.point.direction) }}
          </UButton>
        </template>
      </div>
    </div>
  </Draggable>
</template>

<script setup lang="ts">
import type { AvailableFollowerPlace } from '@server/modules/GameManager'
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
import { computed } from 'vue'

const props = defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})

const meFollowers = computed(() => {
  const currentPlayer = props.gameBoard.currentPlayer
  if (!currentPlayer) return { ordinaryFollowers: 0, monks: 0 }
  return (
    props.gameBoard.playersFollowers[currentPlayer.id] ?? {
      ordinaryFollowers: 0,
      monks: 0,
    }
  )
})

const ordinaryAvailable = computed(() => meFollowers.value.ordinaryFollowers)
const abbotAvailable = computed(() => meFollowers.value.monks)

const centerFeatureTitle = (place: AvailableFollowerPlace): string =>
  place.temporaryObject?.isGarden ? 'Сад' : 'Монастырь'

const placeFollower = (
  place: AvailableFollowerPlace,
  type: 'follower' | 'abbot'
) => {
  GameService.placeFollower(place, type)
}
</script>
