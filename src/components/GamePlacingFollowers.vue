<template>
  <GamePanel
    v-if="showPanel"
    draggable-id="placing-followers"
    :initial-x="700"
    :initial-y="400"
    :drag-enabled="dragEnabled"
    icon="i-lucide-person-standing"
    title="Поставить подданного"
    surface-class="min-w-[220px] max-w-[300px] p-4"
  >
    <div v-if="gameBoard.princessFollowerPenalty" class="mb-2 text-text-muted">
      Принцесса забрала подданного — на этот тайл свою фишку поставить нельзя.
      Завершите ход.
    </div>
    <div v-else-if="groupedPlaces.length === 0" class="mb-2 text-text-muted">
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
          @click.stop="placeFollower(group.place, choice.followerType)"
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
      @click="skipFollower()"
    >
      {{
        gameBoard.princessFollowerPenalty
          ? 'Завершить ход'
          : 'Пропустить выставление'
      }}
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
  followerPlaceTitle,
} from '@/utils/labels'
import { notifyError } from '@/utils/common'
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

const groupedPlaces = computed(() =>
  groupFollowerPlaces(props.gameBoard.availableFollowersPlaces)
)

/** Как называется фишка в кнопке выбора. */
const FOLLOWER_TYPE_TITLES: Record<FollowerType, string> = {
  [FollowerType.Follower]: '',
  [FollowerType.Abbot]: 'аббат',
  [FollowerType.BigFollower]: 'большой подданный',
}

const followerChoiceLabel = (
  title: string,
  place: AvailableFollowerPlace,
  followerType: FollowerType
): string => {
  if (followerType === FollowerType.Follower) {
    return place.temporaryObject.isMonastery ? `${title} — монах` : title
  }
  return `${title} — ${FOLLOWER_TYPE_TITLES[followerType]}`
}

const followerChoiceIcon = (
  place: AvailableFollowerPlace,
  followerType: FollowerType
): string => {
  const object = place.temporaryObject
  if (followerType === FollowerType.BigFollower) return 'i-lucide-users-round'
  if (followerType === FollowerType.Abbot) {
    return object.isGarden ? 'i-lucide-flower-2' : 'i-lucide-church'
  }
  return object.isMonastery ? 'i-lucide-person-standing' : placeIcon(place)
}

interface FollowerChoice {
  key: FollowerType
  label: string
  icon: string
  followerType: FollowerType
}

interface ChoiceGroup {
  key: string
  place: AvailableFollowerPlace
  /** Монастырь и сад показываются отдельной группой с подсказкой для тестов. */
  isCenterFeature: boolean
  choices: FollowerChoice[]
}

/**
 * Окно выбора фишки показывается только в ход игрока: сервер присылает
 * `isPlacingFollower` всем, а варианты действий относятся к текущему игроку.
 */
const showPanel = computed(
  () => Boolean(props.gameBoard.isMyTurn) && props.gameBoard.isPlacingFollower
)

/**
 * Кнопки выбора фишки для каждого доступного места. Набор допустимых типов
 * приходит с сервером вместе с состоянием партии, поэтому интерфейс не решает,
 * какая фишка куда разрешена; здесь остаются только подписи и значки.
 */
const choiceGroups = computed<ChoiceGroup[]>(() =>
  groupedPlaces.value.map(({ place, sameTypeCount }, index) => {
    const followerTypes =
      props.gameBoard.availableFollowerTypes?.[place.temporaryObject.id] ?? []

    const choices: FollowerChoice[] = followerTypes.map((followerType) => ({
      key: followerType,
      label: followerChoiceLabel(
        followerPlaceTitle(place, sameTypeCount),
        place,
        followerType
      ),
      icon: followerChoiceIcon(place, followerType),
      followerType,
    }))

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
  void GameService.placeFollower(place, type).catch((error: unknown) => {
    notifyError(error, 'Не удалось выставить подданного')
  })
}

const skipFollower = () => {
  void GameService.skipFollower().catch((error: unknown) => {
    notifyError(error, 'Не удалось пропустить выставление')
  })
}
</script>
