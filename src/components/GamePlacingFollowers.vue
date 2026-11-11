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
    surface-class="min-w-[220px] max-w-[300px] p-3"
    @toggle="toggle"
  >
    <div v-if="gameBoard.princessFollowerPenalty" class="mb-1 text-text-muted">
      {{ t('follower_penalty') }}
    </div>
    <div v-else-if="isPortalMode && !selectedTile" class="mb-1 text-text-muted">
      {{ t('follower_portal_choose_tile') }}
    </div>
    <div
      v-else-if="
        !isPortalMode && groupedPlaces.length === 0 && !gameBoard.isPlacingFairy
      "
      class="mb-1 text-text-muted"
    >
      {{ t('follower_no_options') }}
    </div>
    <div v-if="isPortalMode && !selectedTile" class="flex flex-col gap-1">
      <div
        v-for="tile in tileGroups"
        :key="`tile-${tile.x}-${tile.y}`"
        class="rounded-lg hover:bg-surface-muted border border-border/40"
      >
        <UButton
          block
          variant="ghost"
          class="btn-choice cursor-pointer justify-start gap-2 rounded-lg font-semibold text-text py-2"
          @click="selectedTile = { x: tile.x, y: tile.y }"
        >
          <span class="flex min-w-0 flex-col items-start text-left gap-0.5">
            <span class="text-sm leading-tight">
              {{ t('follower_portal_tile', { x: tile.x + 1, y: tile.y + 1 }) }}
            </span>
            <span class="text-[10px] leading-none text-text-muted">
              {{ t('follower_portal_tile_count', { count: tile.count }) }}
            </span>
          </span>
        </UButton>
      </div>
    </div>
    <div
      v-else-if="isPortalMode && selectedTile"
      class="mb-2 flex items-center gap-2"
    >
      <UButton
        icon
        size="xs"
        variant="ghost"
        class="h-8 w-8 rounded-lg"
        @click="selectedTile = null"
      >
        <UIcon name="i-lucide-arrow-left" class="h-4 w-4" />
      </UButton>
      <span class="text-xs font-semibold text-text-muted capitalize">
        {{
          t('follower_portal_selected', {
            x: selectedTile.x + 1,
            y: selectedTile.y + 1,
          })
        }}
      </span>
    </div>
    <div v-if="!isPortalMode || selectedTile" class="flex flex-col gap-1">
      <div
        v-for="group in portalChoiceGroups"
        :key="group.key"
        class="flex flex-col gap-1"
        :data-testid="
          group.isCenterFeature ? TEST_IDS.followerPlacementOptions : undefined
        "
      >
        <!-- Разделитель и заголовок типа объекта (город, дорога, поле...). -->
        <div v-if="group.typeTitle" class="flex items-center gap-1.5 mb-0.5">
          <span class="text-xs font-semibold text-text-muted capitalize">
            {{ group.typeTitle }}
          </span>
          <div class="flex-1 border-b border-border/60" />
        </div>
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
            <span class="flex min-w-0 flex-col items-start text-left gap-0.5">
              <span class="text-sm leading-tight">{{ choice.label }}</span>
              <!-- Признак большого подданного: мелкий текст другого цвета. -->
              <span
                v-if="choice.isBig"
                class="text-[10px] leading-none text-text-muted"
              >
                {{ t('follower_big') }}
              </span>
              <!-- Ссылка на тайл, чтобы переместиться к клетке подданного. -->
              <span
                class="mt-0.5 text-[10px] leading-none text-primary underline underline-offset-2 hover:text-primary-dark cursor-pointer"
                :title="
                  t('follower_show_tile', {
                    x: group.place.point.x + 1,
                    y: group.place.point.y + 1,
                  })
                "
                @click.stop.prevent="
                  zoomToTile({
                    rowIndex: group.place.point.y,
                    tileIndex: group.place.point.x,
                  })
                "
              >
                {{ group.place.point.x + 1 }}, {{ group.place.point.y + 1 }}
              </span>
            </span>
          </UButton>
        </div>
      </div>
    </div>
    <div
      v-if="showFairyActions && gameBoard.fairyTargets?.length"
      class="mt-2 border-t border-border/60 pt-2"
    >
      <p class="mb-1.5 text-sm text-text-muted">
        {{
          gameBoard.isPlacingFairy
            ? t('follower_fairy_hint_placing')
            : t('follower_fairy_hint_offer')
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
          :title="
            t('follower_show_tile', {
              x: target.point.x + 1,
              y: target.point.y + 1,
            })
          "
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
      class="btn-secondary mt-1 min-h-10 w-full cursor-pointer rounded-lg px-4 font-semibold"
      @click="skipFollower()"
    >
      {{
        gameBoard.princessFollowerPenalty || gameBoard.isPlacingFairy
          ? t('follower_finish_turn')
          : t('follower_skip')
      }}
    </UButton>
  </GamePanel>
</template>

<script setup lang="ts">
import type { AvailableFollowerPlace } from '@server/modules/GameManager'
import {
  FollowerType,
  ObjectTypes,
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
import { getFollowerPlaceType } from '@/utils/followerPlaces'
import { notifyError } from '@/utils/common'
import { playerColorValue } from '@/utils/colors'
import { groupFollowerPlaces } from '@/utils/followerPlaces'
import { usePanelCollapse } from '@/composables/usePanelCollapse'
import { useBoardZoom } from '@/composables/useBoardZoom'
import { t } from '@/utils/i18n'
import { computed, onBeforeUnmount, ref } from 'vue'

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

/** Выбранный тайл в режиме магического портала: null, пока игрок не выбрал клетку на доске. */
const selectedTile = ref<{ x: number; y: number } | null>(null)

/** Уникальные тайлы, на которых есть доступные места для подданного. */
const tileGroups = computed(() => {
  const byTile = new Map<string, { x: number; y: number; count: number }>()
  for (const { place } of groupedPlaces.value) {
    const { x, y } = place.point
    const key = `${x}:${y}`
    if (byTile.has(key)) {
      byTile.get(key)!.count += 1
    } else {
      byTile.set(key, { x, y, count: 1 })
    }
  }
  return [...byTile.values()]
})

/** Режим магического портала: места доступны на нескольких тайлах доски. */
const isPortalMode = computed(() => tileGroups.value.length > 1)

/** Варианты размещения, отфильтрованные по выбранному тайлу (если портал). */
const filteredGroupedPlaces = computed(() => {
  if (!selectedTile.value) return groupedPlaces.value
  return groupedPlaces.value.filter(
    ({ place }) =>
      place.point.x === selectedTile.value!.x &&
      place.point.y === selectedTile.value!.y
  )
})

/** Окно можно свернуть, чтобы не закрывать доску. */
const { collapsed, toggle } = usePanelCollapse('placing-followers')

/** Как называется фишка в кнопке выбора. */
const FOLLOWER_TYPE_TITLES: Record<FollowerType, string> = {
  get [FollowerType.Follower]() {
    return ''
  },
  get [FollowerType.Abbot]() {
    return t('follower_abbot')
  },
  get [FollowerType.BigFollower]() {
    return t('follower_big')
  },
}

const followerChoiceLabel = (
  title: string,
  place: AvailableFollowerPlace,
  followerType: FollowerType
): string => {
  if (followerType === FollowerType.Follower) {
    return place.temporaryObject.isMonastery
      ? t('follower_label_monk', { title })
      : title
  }
  if (followerType === FollowerType.BigFollower) {
    return place.temporaryObject.isMonastery
      ? t('follower_label_monk', { title })
      : title
  }
  return t('follower_label_typed', {
    title,
    type: FOLLOWER_TYPE_TITLES[followerType],
  })
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
  /** Большой подданный: показывается отдельной мелкой подписью под вариантом. */
  isBig: boolean
}

interface ChoiceGroup {
  key: string
  place: AvailableFollowerPlace
  objectType: string
  /** Заголовок типа объекта показывается только перед первой группой этого типа. */
  typeTitle?: string
  /** Монастырь и сад показываются отдельной группой с подсказкой для тестов. */
  isCenterFeature: boolean
  choices: FollowerChoice[]
}

/** Порядок типов объектов в списке вариантов. */
const OBJECT_TYPE_ORDER: Record<string, number> = {
  [TileSideType.City]: 0,
  [TileSideType.Road]: 1,
  [TileSideType.Field]: 2,
  [ObjectTypes.MONASTERY]: 3,
  [ObjectTypes.GARDEN]: 4,
}

const objectTypeTitle = (type: string): string => {
  switch (type) {
    case TileSideType.City:
      return t('object_city')
    case TileSideType.Road:
      return t('object_road')
    case TileSideType.Field:
      return t('object_field')
    case ObjectTypes.MONASTERY:
      return t('object_monastery')
    case ObjectTypes.GARDEN:
      return t('object_garden')
    default:
      return t('object_generic')
  }
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
  props.gameBoard.isPlacingFairy
    ? t('follower_panel_move_fairy')
    : t('follower_panel_place')
)

function fairyTargetDescription(target: FairyFollowerRef): string {
  const player = props.gameBoard.players.find(
    ({ id }) => String(id) === String(target.playerId)
  )
  const playerName = player?.name ?? t('fairy_target_unknown_player')
  if (target.isAbbot) {
    return t('fairy_target_abbot', { player: playerName })
  }
  if (target.isBigFollower) {
    return t('fairy_target_big', { player: playerName })
  }
  if (target.point.pointType === TileSideType.Field) {
    return t('fairy_target_peasant', { player: playerName })
  }
  return t('fairy_target_follower', { player: playerName })
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
  selectedTile.value = null
})

/**
 * Кнопки выбора фишки для каждого доступного места. Набор допустимых типов
 * приходит с сервером вместе с состоянием партии, поэтому интерфейс не решает,
 * какая фишка куда разрешена; здесь остаются только подписи и значки.
 */
const portalChoiceGroups = computed<ChoiceGroup[]>(() => {
  const places = filteredGroupedPlaces.value
  const titles = disambiguateFollowerPlaceTitles(
    places.map(({ place }) => place),
    places.map(({ place, sameTypeCount }) =>
      followerPlaceTitle(
        place,
        sameTypeCount,
        props.gameBoard.tilePlacesStats[place.point.y]?.[place.point.x]
          ?.fieldTopology
      )
    )
  )

  const groups = places.map(({ place }, index) => {
    const followerTypes =
      props.gameBoard.availableFollowerTypes?.[place.temporaryObject.id] ?? []

    const choices: FollowerChoice[] = followerTypes.map((followerType) => ({
      key: followerType,
      label: followerChoiceLabel(titles[index] ?? '', place, followerType),
      icon: followerChoiceIcon(place, followerType),
      followerType,
      isBig: followerType === FollowerType.BigFollower,
    }))

    return {
      key: `${place.temporaryObject.id}-${index}`,
      place,
      objectType: getFollowerPlaceType(place),
      isCenterFeature: Boolean(
        place.temporaryObject.isMonastery || place.temporaryObject.isGarden
      ),
      choices,
    }
  })

  // Сортируем по типу объекта, чтобы варианты одного объекта шли вместе.
  groups.sort(
    (a, b) =>
      (OBJECT_TYPE_ORDER[a.objectType] ?? 99) -
      (OBJECT_TYPE_ORDER[b.objectType] ?? 99)
  )

  // Заголовок типа показываем только перед первой группой каждого типа.
  const shownTypes = new Set<string>()
  return groups.map((group) => {
    const typeTitle = shownTypes.has(group.objectType)
      ? undefined
      : objectTypeTitle(group.objectType)
    shownTypes.add(group.objectType)
    return { ...group, typeTitle }
  })
})

const placeFollower = (place: AvailableFollowerPlace, type: FollowerType) => {
  selectedTile.value = null
  void GameService.placeFollower(place, type).catch((error: unknown) => {
    notifyError(error, t('action_place_follower_error'))
  })
}

const skipFollower = () => {
  selectedTile.value = null
  void GameService.skipFollower().catch((error: unknown) => {
    notifyError(error, t('action_skip_follower_error'))
  })
}

const moveFairy = (point: Point) => {
  void GameService.moveFairy(point).catch((error: unknown) => {
    notifyError(error, t('action_move_fairy_error'))
  })
}
</script>
