<template>
  <Draggable
    v-if="gameBoard.isPlacingFollower"
    draggable-id="placing-followers"
    :initial-x="700"
    :initial-y="400"
    :drag-enabled="dragEnabled"
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
      <div v-if="groupedPlaces.length === 0" class="mb-2 text-text-muted">
        Нет доступных вариантов
      </div>
      <div v-else class="flex flex-col gap-1.5">
        <template
          v-for="({ place, sameTypeCount }, index) in groupedPlaces"
          :key="`${place.temporaryObject.id}-${index}`"
        >
          <div
            v-if="
              place.temporaryObject?.isMonastery ||
              place.temporaryObject?.isGarden
            "
            data-testid="follower-placement-options"
            class="flex flex-col gap-1.5"
          >
            <UButton
              v-if="place.temporaryObject?.isMonastery"
              block
              variant="ghost"
              class="btn-choice cursor-pointer justify-start gap-2 rounded-lg font-semibold text-text"
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
              class="btn-choice cursor-pointer justify-start gap-2 rounded-lg font-semibold text-text"
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
            block
            variant="ghost"
            class="btn-choice cursor-pointer justify-start gap-2 rounded-lg font-semibold text-text"
            :disabled="!gameBoard.isMyTurn || ordinaryAvailable === 0"
            @click.stop="gameBoard.isMyTurn && placeFollower(place, 'follower')"
          >
            <template #leading>
              <UIcon :name="placeIcon(place)" class="h-4 w-4 text-gold-dark" />
            </template>
            {{ followerPlaceTitle(place, sameTypeCount) }}
          </UButton>
        </template>
      </div>
      <UButton
        block
        variant="soft"
        color="neutral"
        class="btn-secondary mt-2 min-h-10 w-full cursor-pointer rounded-lg px-4 font-semibold"
        :disabled="!gameBoard.isMyTurn"
        @click="gameBoard.isMyTurn && GameService.skipFollower()"
      >
        Пропустить выставление
      </UButton>
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
import { groupFollowerPlaces } from '@/utils/followerPlaces'
import { computed } from 'vue'

const props = defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
  dragEnabled: {
    type: Boolean,
    default: false,
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
const groupedPlaces = computed(() =>
  groupFollowerPlaces(props.gameBoard.availableFollowersPlaces)
)

const centerFeatureTitle = (place: AvailableFollowerPlace): string =>
  place.temporaryObject?.isGarden ? 'Сад' : 'Монастырь'

const followerPlaceTitle = (
  place: AvailableFollowerPlace,
  sameTypeCount: number
): string => {
  const title = pointTypeTitle(place.point.pointType)
  if (sameTypeCount === 1) return title
  return `${title} — ${pointDirectionTitle(place.point.direction)}`
}

const placeFollower = (
  place: AvailableFollowerPlace,
  type: 'follower' | 'abbot'
) => {
  GameService.placeFollower(place, type)
}
</script>
