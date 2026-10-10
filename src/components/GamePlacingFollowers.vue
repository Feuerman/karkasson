<template>
  <GamePanel
    v-if="gameBoard.isPlacingFollower"
    draggable-id="placing-followers"
    :initial-x="700"
    :initial-y="400"
    :drag-enabled="dragEnabled"
    icon="i-lucide-person-standing"
    title="Поставить подданного"
    surface-class="min-w-[220px] max-w-[300px] p-4"
  >
    <div v-if="groupedPlaces.length === 0" class="mb-2 text-text-muted">
      Нет доступных вариантов
    </div>
    <div v-else class="flex flex-col gap-1.5">
      <div
        v-for="group in choiceGroups"
        :key="group.key"
        class="flex flex-col gap-1.5"
        :data-testid="
          group.isCenterFeature ? TEST_IDS.followerPlacementOptions : undefined
        "
      >
        <UButton
          v-for="choice in group.choices"
          :key="choice.key"
          block
          variant="ghost"
          class="btn-choice cursor-pointer justify-start gap-2 rounded-lg font-semibold text-text"
          :disabled="choice.disabled"
          @click.stop="
            gameBoard.isMyTurn &&
            placeFollower(group.place, choice.followerType)
          "
        >
          <template #leading>
            <UIcon :name="choice.icon" class="h-4 w-4 text-gold-dark" />
          </template>
          {{ choice.label }}
        </UButton>
      </div>
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
  </GamePanel>
</template>

<script setup lang="ts">
import type { AvailableFollowerPlace } from '@server/modules/GameManager'
import { FollowerType } from '@server/modules/types'
import type { IGameBoard } from '@/types/game'
import GamePanel from '@/components/GamePanel.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import GameService from '@/modules/GameService'
import { TEST_IDS } from '@/data/testIds'
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
  if (!currentPlayer) return { ordinaryFollowers: 0, bigFollowers: 0, monks: 0 }
  return (
    props.gameBoard.playersFollowers[currentPlayer.id] ?? {
      ordinaryFollowers: 0,
      bigFollowers: 0,
      monks: 0,
    }
  )
})

const ordinaryAvailable = computed(() => meFollowers.value.ordinaryFollowers)
const bigAvailable = computed(() => meFollowers.value.bigFollowers)
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

interface FollowerChoice {
  key: FollowerType
  label: string
  icon: string
  followerType: FollowerType
  disabled: boolean
}

interface ChoiceGroup {
  key: string
  place: AvailableFollowerPlace
  /** Монастырь и сад показываются отдельной группой с подсказкой для тестов. */
  isCenterFeature: boolean
  choices: FollowerChoice[]
}

/**
 * Кнопки выбора фишки для каждого доступного места. На монастыре и саду
 * предлагаются монах, аббат и большой подданный, на дороге и городе —
 * подданный и большой подданный. Большой подданный доступен только с
 * дополнением «Таверны и соборы» и не ставится в сад.
 */
const choiceGroups = computed<ChoiceGroup[]>(() =>
  groupedPlaces.value.map(({ place, sameTypeCount }, index) => {
    const isMyTurn = Boolean(props.gameBoard.isMyTurn)
    const bigFollower =
      place.temporaryObject.isMonastery || place.temporaryObject.isGarden
        ? `${centerFeatureTitle(place)} — большой подданный`
        : `${followerPlaceTitle(place, sameTypeCount)} — большой подданный`
    const choices: FollowerChoice[] = []

    if (place.temporaryObject.isMonastery || place.temporaryObject.isGarden) {
      if (place.temporaryObject.isMonastery) {
        choices.push({
          key: FollowerType.Follower,
          label: 'Монастырь — монах',
          icon: 'i-lucide-person-standing',
          followerType: FollowerType.Follower,
          disabled: !isMyTurn || ordinaryAvailable.value === 0,
        })
      }
      choices.push({
        key: FollowerType.Abbot,
        label: `${centerFeatureTitle(place)} — аббат`,
        icon: place.temporaryObject.isGarden
          ? 'i-lucide-flower-2'
          : 'i-lucide-church',
        followerType: FollowerType.Abbot,
        disabled: !isMyTurn || abbotAvailable.value === 0,
      })
    } else {
      choices.push({
        key: FollowerType.Follower,
        label: followerPlaceTitle(place, sameTypeCount),
        icon: placeIcon(place),
        followerType: FollowerType.Follower,
        disabled: !isMyTurn || ordinaryAvailable.value === 0,
      })
    }

    if (
      props.gameBoard.rules?.expansions.innsAndCathedrals &&
      !place.temporaryObject.isGarden
    ) {
      choices.push({
        key: FollowerType.BigFollower,
        label: bigFollower,
        icon: 'i-lucide-users-round',
        followerType: FollowerType.BigFollower,
        disabled: !isMyTurn || bigAvailable.value === 0,
      })
    }

    return {
      key: `${place.temporaryObject.id}-${index}`,
      place,
      isCenterFeature: Boolean(
        place.temporaryObject.isMonastery || place.temporaryObject.isGarden
      ),
      choices,
    }
  })
)

const placeFollower = (place: AvailableFollowerPlace, type: FollowerType) => {
  GameService.placeFollower(place, type)
}
</script>
