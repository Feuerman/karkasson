<template>
  <GamePanel
    v-if="showPanel"
    draggable-id="placing-followers"
    :initial-x="700"
    :initial-y="400"
    :drag-enabled="dragEnabled"
    :collapsed="collapsed"
    :icon="
      gameBoard.isPlacingFairy
        ? 'i-lucide-sparkles'
        : 'i-lucide-person-standing'
    "
    :title="panelTitle"
    surface-class="min-w-[220px] max-w-[300px] p-4"
    @toggle="toggle"
  >
    <div v-if="gameBoard.princessFollowerPenalty" class="mb-2 text-text-muted">
      Принцесса забрала подданного — на этот тайл свою фишку поставить нельзя.
      Завершите ход.
    </div>
    <div
      v-else-if="groupedPlaces.length === 0 && !gameBoard.isPlacingFairy"
      class="mb-2 text-text-muted"
    >
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
        <div
          v-for="choice in group.choices"
          :key="choice.key"
          class="rounded-lg hover:bg-surface-muted"
        >
          <UButton
            block
            variant="ghost"
            class="btn-choice cursor-pointer justify-start gap-2 rounded-lg font-semibold text-text"
            @focus="previewFollowerPlace(group.place, choice.followerType)"
            @blur="clearFollowerPlacePreview"
            @mouseenter="previewFollowerPlace(group.place, choice.followerType)"
            @mouseleave="clearFollowerPlacePreview"
            @click.stop="placeFollower(group.place, choice.followerType)"
          >
            <template #leading>
              <UIcon :name="choice.icon" class="h-4 w-4 text-secondary-dark" />
            </template>
            <span class="flex min-w-0 flex-col items-start text-left">
              <span>{{ choice.label }}</span>
            </span>
          </UButton>
        </div>
      </div>
    </div>
    <div
      v-if="showFairyActions && gameBoard.fairyTargets?.length"
      class="mt-3 border-t border-border/60 pt-3"
    >
      <p class="mb-1.5 text-sm text-text-muted">
        {{
          gameBoard.isPlacingFairy
            ? 'Можно переместить фею к своему подданному или завершить ход.'
            : 'Вместо выставления подданного можно переместить фею.'
        }}
      </p>
      <div
        v-for="(target, index) in gameBoard.fairyTargets ?? []"
        :key="`fairy-${target.playerId}-${target.point.x}-${target.point.y}-${target.point.regionIndex ?? target.point.direction ?? index}`"
        class="flex items-center gap-1 rounded-lg hover:bg-surface-muted"
        @mouseenter="previewFairyTarget(target.point)"
        @mouseleave="clearFairyTargetPreview"
      >
        <UButton
          block
          variant="ghost"
          class="btn-choice min-w-0 flex-1 cursor-pointer justify-start gap-2 rounded-lg font-semibold text-text"
          @click.stop="moveFairy(target.point)"
        >
          <template #leading>
            <UIcon
              name="i-lucide-sparkles"
              class="h-4 w-4 text-secondary-dark"
            />
          </template>
          {{ fairyTargetDescription(target) }}
        </UButton>
        <a
          href="#"
          class="shrink-0 cursor-pointer text-primary underline underline-offset-2 hover:text-primary-dark"
          :title="`Показать тайл ${target.point.x + 1}, ${target.point.y + 1}`"
          @click.stop.prevent="zoomToFairyTarget(target.point)"
        >
          {{ target.point.x + 1 }}, {{ target.point.y + 1 }}
        </a>
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
        gameBoard.princessFollowerPenalty || gameBoard.isPlacingFairy
          ? 'Завершить ход'
          : 'Пропустить выставление'
      }}
    </UButton>
  </GamePanel>
</template>

<script setup lang="ts">
import type { AvailableFollowerPlace } from '@server/modules/GameManager'
import {
  FollowerType,
  TileSideType,
  type FairyFollowerRef,
  type Point,
} from '@server/modules/types'
import type { IGameBoard } from '@/types/game'
import GamePanel from '@/components/GamePanel.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import GameService from '@/modules/GameService'
import { TEST_IDS } from '@/data/testIds'
import {
  disambiguateFollowerPlaceTitles,
  followerPlaceIcon as placeIcon,
  followerPlaceTitle,
} from '@/utils/labels'
import { notifyError } from '@/utils/common'
import { playerColorValue } from '@/utils/colors'
import { groupFollowerPlaces } from '@/utils/followerPlaces'
import { usePanelCollapse } from '@/composables/usePanelCollapse'
import { useBoardZoom } from '@/composables/useBoardZoom'
import { computed, onBeforeUnmount } from 'vue'

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
  groupFollowerPlaces(props.gameBoard.availableFollowersPlaces ?? [])
)

/** Окно можно свернуть, чтобы не закрывать доску. */
const { collapsed, toggle } = usePanelCollapse('placing-followers')

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
  () =>
    Boolean(props.gameBoard.isMyTurn) &&
    (props.gameBoard.isPlacingFollower || props.gameBoard.isPlacingFairy)
)

const showFairyActions = computed(
  () =>
    props.gameBoard.rules.expansions.princessAndDragon &&
    !props.gameBoard.princessFollowerPenalty &&
    (props.gameBoard.isPlacingFollower || props.gameBoard.isPlacingFairy)
)

const panelTitle = computed(() =>
  props.gameBoard.isPlacingFairy ? 'Переместить фею' : 'Поставить подданного'
)

function fairyTargetDescription(target: FairyFollowerRef): string {
  const kind = target.isAbbot
    ? 'аббату'
    : target.isBigFollower
      ? 'большому подданному'
      : target.point.pointType === TileSideType.Field
        ? 'крестьянину'
        : 'подданному'
  const player = props.gameBoard.players.find(
    ({ id }) => String(id) === String(target.playerId)
  )
  return `Фея к ${kind} ${player?.name ?? 'игрока'}`
}

const {
  zoomToTile,
  setFairyTargetPreview,
  setFollowerPlacementPreview,
  clearFollowerPlacementPreview,
} = useBoardZoom()

const previewFollowerPlace = (
  place: AvailableFollowerPlace,
  followerType: FollowerType
) => {
  const playerColor = playerColorValue(props.gameBoard.currentPlayer?.color)
  setFollowerPlacementPreview(place.point, followerType, playerColor)
}

const clearFollowerPlacePreview = clearFollowerPlacementPreview

const previewFairyTarget = (point: Point) => {
  setFairyTargetPreview({ rowIndex: point.y, tileIndex: point.x })
}

const clearFairyTargetPreview = () => setFairyTargetPreview(null)

const zoomToFairyTarget = (point: Point) => {
  zoomToTile({ rowIndex: point.y, tileIndex: point.x })
}

onBeforeUnmount(() => {
  clearFairyTargetPreview()
  clearFollowerPlacePreview()
})

/**
 * Кнопки выбора фишки для каждого доступного места. Набор допустимых типов
 * приходит с сервером вместе с состоянием партии, поэтому интерфейс не решает,
 * какая фишка куда разрешена; здесь остаются только подписи и значки.
 */
const choiceGroups = computed<ChoiceGroup[]>(() => {
  const titles = disambiguateFollowerPlaceTitles(
    groupedPlaces.value.map(({ place }) => place),
    groupedPlaces.value.map(({ place, sameTypeCount }) =>
      followerPlaceTitle(
        place,
        sameTypeCount,
        props.gameBoard.tilePlacesStats[place.point.y]?.[place.point.x]
          ?.fieldTopology
      )
    )
  )

  return groupedPlaces.value.map(({ place }, index) => {
    const followerTypes =
      props.gameBoard.availableFollowerTypes?.[place.temporaryObject.id] ?? []

    const choices: FollowerChoice[] = followerTypes.map((followerType) => ({
      key: followerType,
      label: followerChoiceLabel(titles[index] ?? '', place, followerType),
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
})

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

const moveFairy = (point: Point) => {
  void GameService.moveFairy(point).catch((error: unknown) => {
    notifyError(error, 'Не удалось переместить фею')
  })
}
</script>
