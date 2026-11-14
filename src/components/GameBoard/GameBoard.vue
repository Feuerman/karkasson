<template>
  <GameControls :game-board="gameBoard" :drag-enabled="layoutEditMode" />
  <GameActionsHistory :game-board="gameBoard" :drag-enabled="layoutEditMode" />
  <GamePlacingFollowers
    :game-board="gameBoard"
    :drag-enabled="layoutEditMode"
    :portal-selected-tile="portalSelectedTile"
    @update:portal-selected-tile="portalSelectedTile = $event"
  />
  <GamePrincessAndDragon
    :game-board="gameBoard"
    :drag-enabled="layoutEditMode"
  />
  <GameAbbotRecall :game-board="gameBoard" :drag-enabled="layoutEditMode" />
  <div
    ref="boardRef"
    class="board-surface min-h-0 w-full flex-1 touch-none select-none overflow-auto rounded-xl shadow-[inset_0_0_30px_rgba(0,0,0,0.3)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden outline-none"
    :class="isPanning ? 'cursor-grabbing' : 'cursor-grab'"
    tabindex="-1"
    @mousedown="onMouseDown"
    @click.capture="onClickCapture"
    @keydown="onBoardKeyDown"
  >
    <div ref="sizeBoxRef">
      <div
        ref="planeRef"
        class="grid origin-top-left gap-2.5 p-2.5"
        :style="{
          gridTemplateColumns: `repeat(${gridDimensions[0]}, ${TILE_SIZE}px)`,
        }"
      >
        <div
          v-for="(row, rowIndex) in defaultGrid"
          :key="rowIndex"
          class="contents"
        >
          <div
            v-for="(_, tileIndex) in row"
            :key="tileIndex"
            :data-row-index="rowIndex"
            :data-tile-index="tileIndex"
            :data-available="isAvailableCell(rowIndex, tileIndex) || undefined"
            :data-testid="boardCellTestId(rowIndex, tileIndex)"
            role="button"
            :tabindex="isFocusedCell(rowIndex, tileIndex) ? 0 : -1"
            :aria-label="cellLabel(rowIndex, tileIndex)"
            :aria-pressed="isGhostCell(rowIndex, tileIndex)"
            class="tile-keyboard-focus relative flex-shrink-0 rounded-card border border-black/10 bg-black/[0.04] shadow-[0_6px_14px_-6px_rgba(0,0,0,0.35)] transition-all duration-200"
            :style="cellStyle(rowIndex, tileIndex)"
            :class="[
              gameBoard.tilePlacesStats?.[rowIndex]?.[tileIndex]
                ? 'border-black/15'
                : '',
              isDragonCell(rowIndex, tileIndex) ? 'tile-pulse' : '',
              isFairyCell(rowIndex, tileIndex)
                ? 'ring-2 ring-secondary-dark/70'
                : '',
              isFairyTargetPreview(rowIndex, tileIndex)
                ? 'ring-4 ring-primary shadow-[0_0_24px_rgba(255,220,90,0.9)]'
                : '',
              conflictCells.has(`${rowIndex}:${tileIndex}`)
                ? 'tile-conflict'
                : '',
              isAvailableCell(rowIndex, tileIndex) ? 'tile-available' : '',
              isPortalTile(rowIndex, tileIndex) &&
              !isSelectedPortalTile(rowIndex, tileIndex)
                ? 'tile-portal'
                : '',
              isSelectedPortalTile(rowIndex, tileIndex)
                ? 'tile-portal-selected'
                : '',
              isLastActionCell(rowIndex, tileIndex) ? 'tile-last-action' : '',
              targetCells.size > 0 && !isTargetCell(rowIndex, tileIndex)
                ? 'tile-dimmed'
                : '',
            ]"
            @click="handleTileClick(rowIndex, tileIndex)"
          >
            <TileView
              :tile="gameBoard.tilePlacesStats?.[rowIndex]?.[tileIndex]"
              :followers="
                followersByCell[rowIndex]?.[tileIndex] ?? EMPTY_CELL_FOLLOWERS
              "
              :field-followers="
                fieldFollowersByCell[rowIndex]?.[tileIndex] ??
                EMPTY_CELL_FIELD_FOLLOWERS
              "
              :follower-preview="followerPreviewForCell(rowIndex, tileIndex)"
              :players="gameBoard.players"
              :size="TILE_SIZE"
            />
            <div
              v-if="isFairyCell(rowIndex, tileIndex)"
              class="pointer-events-none absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-surface/85 text-xl shadow-card ring-1 ring-secondary-dark/50"
              role="img"
              :aria-label="fairyLabel"
            >
              🧚
            </div>
            <LastActionBubble
              :is-visible="isLastActionBubbleCell(rowIndex, tileIndex)"
              :points="lastActionBubble?.points ?? 0"
              :color="lastActionColor"
            />
            <div
              v-if="isGhostCell(rowIndex, tileIndex)"
              class="tile-selected absolute inset-0 rounded-card"
            >
              <div
                v-if="tileIndex > 0"
                class="absolute left-[-32px] top-1/2 -translate-y-1/2"
              >
                <UButton
                  color="primary"
                  icon="i-lucide-rotate-ccw"
                  class="btn-primary-action flex h-7 w-7 cursor-pointer !p-0 text-white shadow-soft"
                  :ui="{ leadingIcon: 'size-4' }"
                  :title="t('board_rotate_ccw')"
                  :aria-label="t('board_rotate_ccw')"
                  :data-testid="TEST_IDS.cellRotateTileCounterclockwise"
                  @mousedown.stop
                  @click.stop.prevent="
                    rotateLocalTile(
                      localCurrentTile,
                      RotationDirection.Counterclockwise
                    )
                  "
                />
              </div>
              <div class="tile-ghost-placed h-full w-full">
                <TileView
                  :tile="localCurrentTile"
                  :size="TILE_SIZE"
                  class="h-full w-full"
                />
              </div>
              <div
                v-if="tileIndex < gridDimensions[0] - 1"
                class="absolute right-[-32px] top-1/2 -translate-y-1/2"
              >
                <UButton
                  color="primary"
                  icon="i-lucide-rotate-cw"
                  class="btn-primary-action flex h-7 w-7 cursor-pointer !p-0 text-white shadow-soft"
                  :ui="{ leadingIcon: 'size-4' }"
                  :title="t('board_rotate_cw')"
                  :aria-label="t('board_rotate_cw')"
                  :data-testid="TEST_IDS.cellRotateTileClockwise"
                  @mousedown.stop
                  @click.stop.prevent="
                    rotateLocalTile(
                      localCurrentTile,
                      RotationDirection.Clockwise
                    )
                  "
                />
              </div>
            </div>
            <div
              v-if="
                gameBoard.dragonPosition?.rowIndex === rowIndex &&
                gameBoard.dragonPosition?.tileIndex === tileIndex
              "
              class="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]"
              role="img"
              :aria-label="t('board_dragon')"
            >
              🐉
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <PendingTilePreview
    v-if="canShowPlacementUi"
    :placement-error="placementError"
    :has-selected-cell="hasSelectedCell"
    :local-current-tile="localCurrentTile"
    :hovered-tile="hoveredTile"
    :tile-size="TILE_SIZE"
    @rotate-tile="(direction) => rotateLocalTile(localCurrentTile, direction)"
    @place-tile="placeTile"
  />
  <OnboardingHint
    v-if="currentStep"
    :step="currentStep"
    :step-index="onboardingStepIndex"
    :total-steps="onboarding.steps.length"
    @done="onboarding.completeStep"
    @skip="onboarding.skipStep"
  />
  <ZoomControls
    :show-lobby="showLobby"
    :zoom-percent="zoomPercent"
    :zoom-in="zoomIn"
    :zoom-out="zoomOut"
    :reset-zoom="resetZoom"
  />
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  toRefs,
  watch,
} from 'vue'
import type { FieldFollower, PlacedFollower } from '@server/modules/types'
import {
  ActionTypes,
  BOARD_GRID_SIZE,
  RotationDirection,
  type PlacementConflict,
  type Tile,
} from '@server/modules/types'
import type { GameAction } from '@server/modules/gameActions'
import type { BoardCell, IGameBoard } from '../../types/game'
import GameActionsHistory from '../GameActionsHistory'
import GameAbbotRecall from '../GameAbbotRecall.vue'
import { useBoardZoom } from '@/composables/useBoardZoom'
import {
  useOnboarding,
  type OnboardingPhase,
} from '@/composables/useOnboarding'
import GameControls from '../GameControls.vue'
import OnboardingHint from './internal/OnboardingHint.vue'
import GamePlacingFollowers from '../GamePlacingFollowers.vue'
import GamePrincessAndDragon from '../GamePrincessAndDragon.vue'
import TileView from '../TileView.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import GameService, { SocketAckError } from '../../modules/GameService'
import { errorMessage, notifyError, throttle } from '../../utils/common'
import notificationService from '../../plugins/notification'
import { boardCellTestId, TEST_IDS } from '../../data/testIds'
import { rotateTile as rotateTileUtil, TILE_SIZE } from '../../utils/tiles'
import { cellOfPoint, findTileElement, highlightCells } from '../../utils/board'
import { boardCellKey, buildAvailableCells } from '../../utils/availableCells'
import { playerColorValue } from '../../utils/colors'
import { t } from '../../utils/i18n'
import { useBoardPan } from '../../composables/useBoardPan'
import LastActionBubble from './internal/LastActionBubble.vue'
import PendingTilePreview from './internal/PendingTilePreview.vue'
import ZoomControls from './internal/ZoomControls.vue'

const props = defineProps<{
  gameBoard: IGameBoard
  layoutEditMode: boolean
  showLobby: boolean
}>()
const { gameBoard, layoutEditMode, showLobby } = toRefs(props)

const {
  boardRef,
  planeRef,
  sizeBoxRef,
  isPanning,
  zoom,
  zoomIn,
  zoomOut,
  resetZoom,
  onMouseDown,
  onClickCapture,
} = useBoardPan()

/** Масштаб доски в процентах: показывается рядом с кнопками. */
const zoomPercent = computed(() => Math.round(zoom.value * 100))

const gridDimensions = computed(
  () => gameBoard.value.gridSize ?? BOARD_GRID_SIZE
)
const defaultGrid = computed(() =>
  Array.from({ length: gridDimensions.value[1] }, () =>
    Array.from({ length: gridDimensions.value[0] }, () => null)
  )
)

const EMPTY_CELL_FOLLOWERS: PlacedFollower[] = []
const EMPTY_CELL_FIELD_FOLLOWERS: FieldFollower[] = []
const followersByCell = ref<PlacedFollower[][][]>([])
const fieldFollowersByCell = ref<FieldFollower[][][]>([])

watch(
  () => gameBoard.value.placedFollowers,
  (placedFollowers) => {
    // До первого `gameUpdated` состояние пустое: поле обязано собираться
    // и в лобби, где партии ещё нет.
    const all = placedFollowers ?? []
    const prev = followersByCell.value
    const next: PlacedFollower[][][] = []
    let changed = false
    for (let r = 0; r < gridDimensions.value[0]; r++) {
      next[r] = []
      for (let c = 0; c < gridDimensions.value[1]; c++) {
        const cellFollowers = all.filter(
          (follower) => follower.point.y === r && follower.point.x === c
        )
        const prevCell = prev[r]?.[c]
        if (
          prevCell &&
          prevCell.length === cellFollowers.length &&
          prevCell.every((follower, index) => follower === cellFollowers[index])
        ) {
          next[r][c] = prevCell
        } else if (cellFollowers.length === 0) {
          next[r][c] = EMPTY_CELL_FOLLOWERS
        } else {
          next[r][c] = cellFollowers
          changed = true
        }
      }
    }
    if (changed || prev.length === 0) {
      followersByCell.value = next
    }
  },
  { deep: true, immediate: true }
)

watch(
  () => gameBoard.value.fieldFollowers,
  (fieldFollowers: FieldFollower[] | undefined) => {
    const all = fieldFollowers ?? []
    const prev = fieldFollowersByCell.value
    const next: FieldFollower[][][] = []
    let changed = false
    for (let r = 0; r < gridDimensions.value[0]; r++) {
      next[r] = []
      for (let c = 0; c < gridDimensions.value[1]; c++) {
        const cellFieldFollowers = all.filter(
          (follower) => follower.point.y === r && follower.point.x === c
        )
        const prevCell = prev[r]?.[c]
        if (
          prevCell &&
          prevCell.length === cellFieldFollowers.length &&
          prevCell.every(
            (follower, index) => follower === cellFieldFollowers[index]
          )
        ) {
          next[r][c] = prevCell
        } else if (cellFieldFollowers.length === 0) {
          next[r][c] = EMPTY_CELL_FIELD_FOLLOWERS
        } else {
          next[r][c] = cellFieldFollowers
          changed = true
        }
      }
    }
    if (changed || prev.length === 0) {
      fieldFollowersByCell.value = next
    }
  },
  { deep: true, immediate: true }
)

/** Клетка доски: выбрана игроком или пришла с сервера. */
const hoveredTile = ref<BoardCell>({})

/**
 * Клетка, на которую кликнул игрок для подсветки цели (любой клик по доске:
 * существующий тайл, объект, координаты). При выкладке нового тайла не
 * используется — там работает обычный «призрак» без приглушения остальных.
 */
const targetCell = ref<BoardCell>({})

/** Целевые клетки для подсветки при клике: только кликнутая клетка. */
const targetCells = computed(() => {
  const cells = new Set<string>()
  const add = (rowIndex?: number, tileIndex?: number) => {
    if (typeof rowIndex === 'number' && typeof tileIndex === 'number') {
      cells.add(`${rowIndex}:${tileIndex}`)
    }
  }

  add(targetCell.value.rowIndex, targetCell.value.tileIndex)

  return cells
})

/**
 * Клетка, на которой стоит фокус.
 *
 * Клеток на доске сотни, поэтому с клавиатуры доступна только одна: стрелки
 * перемещают фокус, а Tab уводит дальше по странице.
 */
const focusedCell = ref({
  rowIndex: Math.floor(BOARD_GRID_SIZE[1] / 2),
  tileIndex: Math.floor(BOARD_GRID_SIZE[0] / 2),
})

/** Клетка под фокусом: по ней ходят стрелками. */
const isFocusedCell = (rowIndex: number, tileIndex: number): boolean =>
  focusedCell.value.rowIndex === rowIndex &&
  focusedCell.value.tileIndex === tileIndex

/** Подпись клетки для программ экранного чтения. */
const cellLabel = (rowIndex: number, tileIndex: number): string => {
  const isBusy = Boolean(
    gameBoard.value.tilePlacesStats?.[rowIndex]?.[tileIndex]
  )
  return isBusy
    ? t('board_cell_busy', { row: rowIndex + 1, col: tileIndex + 1 })
    : t('board_cell', { row: rowIndex + 1, col: tileIndex + 1 })
}

/** Ставит фокус на клетку и показывает её на экране. */
const focusCell = (
  rowIndex: number,
  tileIndex: number,
  scroll: boolean = true
) => {
  const rows = gridDimensions.value[1]
  const columns = gridDimensions.value[0]
  const row = Math.min(Math.max(rowIndex, 0), rows - 1)
  const column = Math.min(Math.max(tileIndex, 0), columns - 1)

  focusedCell.value = { rowIndex: row, tileIndex: column }

  const element = findTileElement(row, column)
  if (!element) return
  element.focus({ preventScroll: true })
  if (scroll) element.scrollIntoView({ block: 'center', inline: 'center' })
}

const setHoveredTile = (point?: BoardCell | null) => {
  hoveredTile.value = {
    rowIndex: point?.rowIndex,
    tileIndex: point?.tileIndex,
  }
}

const hasPlacedPoint = (
  point?: BoardCell | null
): point is { rowIndex: number; tileIndex: number } =>
  typeof point?.rowIndex === 'number' && typeof point?.tileIndex === 'number'

const isSamePlacedPoint = (
  point: BoardCell | null | undefined,
  other: BoardCell
) => point?.rowIndex === other.rowIndex && point?.tileIndex === other.tileIndex

const placementConflicts = ref<PlacementConflict[]>([])
const conflictCells = computed(
  () =>
    new Set(
      placementConflicts.value.map(
        (conflict) => `${conflict.rowIndex}:${conflict.tileIndex}`
      )
    )
)

/** Выбрана ли клетка для размещения текущего тайла. */
const hasSelectedCell = computed(() => hasPlacedPoint(hoveredTile.value))

/** Выбранный тайл в режиме магического портала: задаётся кликом по доске. */
const portalSelectedTile = ref<{ x: number; y: number } | null>(null)

/** Уникальные тайлы с доступными местами для подданного. */
const portalTiles = computed(() => {
  const tiles = new Map<string, { x: number; y: number }>()
  for (const place of gameBoard.value.availableFollowersPlaces ?? []) {
    const { x, y } = place.point
    const key = `${x}:${y}`
    if (!tiles.has(key)) tiles.set(key, { x, y })
  }
  return [...tiles.values()]
})

/** Режим магического портала: места доступны на нескольких тайлах доски. */
const isPortalMode = computed(() => portalTiles.value.length > 1)

/** Доступен ли тайл для выбора через портал. */
const isPortalTile = (rowIndex: number, tileIndex: number): boolean =>
  portalTiles.value.some((t) => t.x === tileIndex && t.y === rowIndex)

/** Выбран ли тайл для портала. */
const isSelectedPortalTile = (rowIndex: number, tileIndex: number): boolean =>
  Boolean(
    portalSelectedTile.value &&
    portalSelectedTile.value.x === tileIndex &&
    portalSelectedTile.value.y === rowIndex
  )

/** Панель размещения видна только в фазе раскладки тайла своего хода. */
const canShowPlacementUi = computed(
  () =>
    gameBoard.value.isMyTurn &&
    !gameBoard.value.isPlacingFollower &&
    !gameBoard.value.isPlacingFairy &&
    !gameBoard.value.dragonMove &&
    !gameBoard.value.princessChoice &&
    !gameBoard.value.gameIsEnded
)

/**
 * Клетки, в которых сервер разрешает поставить тайл.
 *
 * Список приходит с сервером: подсветка помогает игроку выбрать место, но
 * решение о размещении по-прежнему принимает сервер.
 */
const availableCells = computed(() =>
  buildAvailableCells(gameBoard.value.availablePlacesTiles)
)

const localCurrentTile = ref<Tile | null>(null)

/**
 * Причина отказа размещения.
 *
 * Показывается рядом с кнопкой «Разместить» и держится до смены клетки или
 * поворота тайла: всплывающее уведомление живёт несколько секунд, а причину
 * отказа нужно прочитать спокойно.
 */
const placementError = ref('')

const clearPlacementError = () => {
  placementError.value = ''
}

/** Превью рисуется прямо в выбранной клетке доски, поэтому двигается вместе с ней. */
const isGhostCell = (rowIndex: number, tileIndex: number) =>
  canShowPlacementUi.value &&
  hasSelectedCell.value &&
  hoveredTile.value.rowIndex === rowIndex &&
  hoveredTile.value.tileIndex === tileIndex

/** Клетка дракона: её отмечают, пока дракон ждёт хода. */
const isDragonCell = (rowIndex: number, tileIndex: number): boolean =>
  Boolean(gameBoard.value.dragonMove) &&
  gameBoard.value.dragonPosition?.rowIndex === rowIndex &&
  gameBoard.value.dragonPosition?.tileIndex === tileIndex

const isFairyCell = (rowIndex: number, tileIndex: number): boolean =>
  gameBoard.value.fairy?.position?.rowIndex === rowIndex &&
  gameBoard.value.fairy?.position?.tileIndex === tileIndex

const fairyLabel = computed(() => {
  const follower = gameBoard.value.fairy?.follower
  if (!follower) return t('board_fairy_unbound')
  const player = gameBoard.value.players.find(
    ({ id }) => String(id) === String(follower.playerId)
  )
  return t('board_fairy_at_player', { name: player?.name ?? '' })
})

/**
 * Клетка, в которой сервер разрешает поставить тайл.
 *
 * Выбранная клетка из подсветки исключена: её и так отмечает «призрак» тайла.
 */
const isAvailableCell = (rowIndex: number, tileIndex: number): boolean =>
  canShowPlacementUi.value &&
  !gameBoard.value.tilePlacesStats?.[rowIndex]?.[tileIndex] &&
  !isGhostCell(rowIndex, tileIndex) &&
  availableCells.value.has(boardCellKey(rowIndex, tileIndex))

const updateSelectedPlacingPoint = throttle(
  (value: { rowIndex: number; tileIndex: number }) => {
    void GameService.selectPlacingPoint(value).catch((error: unknown) => {
      notifyError(error, t('action_select_cell_error'))
    })
  },
  300
)

const handleTileClick = (rowIndex: number, tileIndex: number) => {
  // Фокус идёт за выбором: с клавиатуры игрок продолжит с этой клетки.
  // При выкладке нового тайла не центрируем поле.
  focusCell(rowIndex, tileIndex, !canShowPlacementUi.value)

  // Целевая клетка для подсветки: работает при клике на существующий тайл
  // или объект, но не при выкладке нового тайла.
  if (!canShowPlacementUi.value) {
    targetCell.value = { rowIndex, tileIndex }
  }

  if (gameBoard.value.isMyTurn) {
    if (gameBoard.value.dragonMove) {
      void GameService.moveDragon({ rowIndex, tileIndex }).catch((error) => {
        notifyError(error, t('action_move_dragon_error'))
      })
      return
    }

    if (gameBoard.value.isPlacingFollower || gameBoard.value.isPlacingFairy) {
      // В режиме портала тайл выбирается кликом прямо на доске.
      if (
        gameBoard.value.isPlacingFollower &&
        isPortalMode.value &&
        isPortalTile(rowIndex, tileIndex)
      ) {
        if (isSelectedPortalTile(rowIndex, tileIndex)) {
          portalSelectedTile.value = null
        } else {
          portalSelectedTile.value = { x: tileIndex, y: rowIndex }
        }
        return
      }
      return
    }

    placementConflicts.value = []
    clearPlacementError()
    setHoveredTile({ rowIndex, tileIndex })
    updateSelectedPlacingPoint({ rowIndex, tileIndex })
  }
}

/**
 * Снимает выбор клетки: «призрак» тайла исчезает.
 *
 * Фокус уходит с клетки на доску: иначе клетка остаётся обведённой рамкой
 * фокуса и кажется, что выбор не отменился.
 */
const clearSelection = () => {
  placementConflicts.value = []
  clearPlacementError()
  setHoveredTile(null)
  targetCell.value = {}
  boardRef.value?.focus()
}

/**
 * Отмена выбора клетки по Escape.
 *
 * Обработчик живёт на документе, а не на доске: после нажатия «Разместить»
 * фокус остаётся на кнопке, и Escape должен снимать выбор в любом случае.
 */
const onDocumentKeyDown = (event: KeyboardEvent) => {
  if (event.code !== 'Escape') return
  if (!canShowPlacementUi.value || !hasSelectedCell.value) return
  // Открытое окно (правила, итоги партии) само обрабатывает Escape.
  if (
    event.target instanceof Element &&
    event.target.closest('[role="dialog"]')
  ) {
    return
  }
  event.preventDefault()
  clearSelection()
}

/**
 * Управление доской с клавиатуры.
 *
 * Стрелки перемещают фокус по клеткам, Enter и пробел выбирают клетку, R
 * поворачивает тайл, P размещает его. Escape снимает выбор — его ловит
 * отдельный обработчик на документе, чтобы кнопка «Разместить» не мешала.
 */
const onBoardKeyDown = (event: KeyboardEvent) => {
  // Кнопки внутри доски (поворот тайла) обрабатывают нажатия сами.
  if (
    event.target instanceof Element &&
    event.target.closest('button, a, input, textarea, select')
  ) {
    return
  }

  const { rowIndex, tileIndex } = focusedCell.value

  switch (event.code) {
    case 'ArrowUp':
      focusCell(rowIndex - 1, tileIndex)
      break
    case 'ArrowDown':
      focusCell(rowIndex + 1, tileIndex)
      break
    case 'ArrowLeft':
      focusCell(rowIndex, tileIndex - 1)
      break
    case 'ArrowRight':
      focusCell(rowIndex, tileIndex + 1)
      break
    case 'Home':
      focusCell(rowIndex, 0)
      break
    case 'End':
      focusCell(rowIndex, gridDimensions.value[0] - 1)
      break
    case 'PageUp':
      focusCell(0, tileIndex)
      break
    case 'PageDown':
      focusCell(gridDimensions.value[1] - 1, tileIndex)
      break
    case 'Enter':
    case 'Space':
      handleTileClick(rowIndex, tileIndex)
      break
    case 'KeyR':
      rotateLocalTile(
        localCurrentTile.value,
        event.shiftKey
          ? RotationDirection.Counterclockwise
          : RotationDirection.Clockwise
      )
      break
    case 'KeyP':
      void placeTile(localCurrentTile.value, hoveredTile.value)
      break
    default:
      return
  }

  event.preventDefault()
}

watch(
  () => gameBoard.value.lastPlacement,
  (value, oldValue) => {
    if (
      value?.rowIndex !== oldValue?.rowIndex ||
      value?.tileIndex !== oldValue?.tileIndex
    ) {
      nextTick(() => zoomToTile(value))
    }
  },
  { immediate: true, deep: true }
)

const zoomToTile = ({ rowIndex, tileIndex }: BoardCell = {}) => {
  if (rowIndex === undefined || tileIndex === undefined) return
  highlightCells([{ rowIndex, tileIndex }], LAST_ACTION_DURATION_MS, false)
}

const { setZoomHandler, fairyTargetPreview, followerPlacementPreview } =
  useBoardZoom()
setZoomHandler(zoomToTile)

const onboarding = useOnboarding()

/**
 * Текущая фаза обучения: определяется по состоянию партии. Подсказка
 * показывается только для первого непройденного шага этой фазы.
 */
const currentPhase = computed<OnboardingPhase | null>(() => {
  const gb = gameBoard.value
  if (!gb.gameIsStarted || gb.gameIsEnded) return null
  if (gb.dragonMove) return 'move-dragon'
  if (gb.princessChoice) return 'princess'
  if (gb.isPlacingFairy) return 'move-fairy'
  if (gb.isPlacingFollower) return 'place-follower'
  if (canShowPlacementUi.value) return 'place-tile'
  if (gb.abbotRecall && gb.isMyTurn) return 'recall-abbot'
  return null
})

watch(
  currentPhase,
  (phase) => {
    onboarding.setPhase(phase)
  },
  { immediate: true }
)

const currentStep = computed(() => onboarding.currentStep.value)

const onboardingStepIndex = computed(() => {
  const step = currentStep.value
  if (!step) return -1
  return onboarding.steps.findIndex((s) => s.id === step.id)
})

/**
 * Завершает шаг обучения, когда сервер подтвердил действие игрока.
 */
watch(
  () => gameBoard.value.actionsHistory?.length ?? 0,
  (length, previousLength) => {
    if (!previousLength || length === 0) return
    const action = gameBoard.value.actionsHistory?.[length - 1]
    if (!action) return
    const stepIdByAction: Record<string, string> = {
      [ActionTypes.PLACE_TILE]: 'place-tile',
      [ActionTypes.PLACE_FOLLOWER]: 'place-follower',
      [ActionTypes.DRAGON_MOVE]: 'move-dragon',
      [ActionTypes.PRINCESS_TAKE_FOLLOWER]: 'princess',
      [ActionTypes.MOVE_FAIRY]: 'move-fairy',
    }
    const stepId = stepIdByAction[action.actionType]
    if (stepId && !onboarding.isCompleted(stepId)) {
      onboarding.completeStep(stepId)
    }
  }
)

const placeTile = async (
  tile: Tile | null,
  { rowIndex, tileIndex }: { rowIndex?: number; tileIndex?: number }
) => {
  if (!tile) return
  if (typeof rowIndex !== 'number' || typeof tileIndex !== 'number') {
    notificationService.warning(t('action_select_cell_first'))
    return
  }

  placementConflicts.value = []
  try {
    await GameService.placeTile(tile, { rowIndex, tileIndex })
    clearPlacementError()
  } catch (error: unknown) {
    if (error instanceof SocketAckError) {
      placementConflicts.value = error.conflicts
    }
    placementError.value = errorMessage(error, t('action_place_tile_error'))
    notifyError(error, t('action_place_tile_error'))
  }
}

const isFairyTargetPreview = (rowIndex: number, tileIndex: number) =>
  fairyTargetPreview.value?.rowIndex === rowIndex &&
  fairyTargetPreview.value?.tileIndex === tileIndex

/** Является ли клетка целевой при активной подсветке. */
const isTargetCell = (rowIndex: number, tileIndex: number): boolean =>
  targetCells.value.has(`${rowIndex}:${tileIndex}`)

const followerPreviewForCell = (rowIndex: number, tileIndex: number) => {
  const preview = followerPlacementPreview.value
  return preview?.point?.y === rowIndex && preview?.point?.x === tileIndex
    ? preview
    : null
}

const LAST_ACTION_DURATION_MS = 3200
const lastActionCell = ref<BoardCell>({})
const lastActionColor = ref<string | null>(null)
const lastActionVisible = ref(false)
let lastActionTimer: ReturnType<typeof setTimeout> | undefined

interface LastActionBubbleData {
  rowIndex: number
  tileIndex: number
  points: number
}

const lastActionBubble = ref<LastActionBubbleData | null>(null)

const clearLastAction = () => {
  if (lastActionTimer) clearTimeout(lastActionTimer)
  lastActionTimer = undefined
  lastActionVisible.value = false
  lastActionBubble.value = null
}

const showLastAction = (
  cell: BoardCell,
  color: string | null,
  points?: number
) => {
  if (cell.rowIndex === undefined || cell.tileIndex === undefined) return

  clearLastAction()
  lastActionCell.value = {
    rowIndex: cell.rowIndex,
    tileIndex: cell.tileIndex,
  }
  lastActionColor.value = color
  lastActionBubble.value =
    typeof points === 'number' && points > 0
      ? {
          rowIndex: cell.rowIndex,
          tileIndex: cell.tileIndex,
          points,
        }
      : null
  lastActionVisible.value = true
  lastActionTimer = setTimeout(() => {
    lastActionVisible.value = false
    lastActionBubble.value = null
    lastActionTimer = undefined
  }, LAST_ACTION_DURATION_MS)
}

const isLastActionCell = (rowIndex: number, tileIndex: number): boolean =>
  lastActionVisible.value &&
  lastActionCell.value.rowIndex === rowIndex &&
  lastActionCell.value.tileIndex === tileIndex

const isLastActionBubbleCell = (rowIndex: number, tileIndex: number): boolean =>
  lastActionVisible.value &&
  lastActionBubble.value?.rowIndex === rowIndex &&
  lastActionBubble.value?.tileIndex === tileIndex

const cellStyle = (rowIndex: number, tileIndex: number) => {
  const style: Record<string, string> = {
    width: `${TILE_SIZE}px`,
    height: `${TILE_SIZE}px`,
  }

  if (isLastActionCell(rowIndex, tileIndex)) {
    style['--last-action-color'] =
      playerColorValue(lastActionColor.value) || '#d4af37'
  }

  return style
}

const actionCell = (action: GameAction): BoardCell => {
  switch (action.actionType) {
    case ActionTypes.PLACE_TILE:
      return {
        rowIndex: action.actionData.rowIndex,
        tileIndex: action.actionData.tileIndex,
      }
    case ActionTypes.PLACE_FOLLOWER:
      return cellOfPoint(action.actionData.point)
    case ActionTypes.DRAGON_MOVE:
      return action.actionData.to
    default:
      return {}
  }
}

const scorePoints = (action: GameAction): number | undefined => {
  if (action.actionType !== ActionTypes.ADDING_SCORES) return undefined
  if (typeof action.actionData.score.total === 'number') {
    return action.actionData.score.total
  }
  return Object.values(action.actionData.score.players ?? {}).reduce<number>(
    (total, points) => total + (points ?? 0),
    0
  )
}

const showLastActionFor = (action: GameAction) => {
  const initiatorId = action.initiator?.id
  const player = (props.gameBoard.players ?? []).find(
    (candidate) => String(candidate.id) === String(initiatorId)
  )
  const cell = actionCell(action)

  if (cell.rowIndex !== undefined && cell.tileIndex !== undefined) {
    showLastAction(cell, player?.color ?? null, scorePoints(action))
    return
  }

  if (action.actionType === ActionTypes.ADDING_SCORES) {
    showLastAction(
      props.gameBoard.lastPlacement ?? {},
      player?.color ?? null,
      scorePoints(action)
    )
  }
}

watch(
  () =>
    [props.gameBoard.id, props.gameBoard.actionsHistory?.length ?? 0] as const,
  ([gameId, length], previous) => {
    if (!previous || previous[0] !== gameId || length === 0) {
      clearLastAction()
      return
    }

    const action = props.gameBoard.actionsHistory?.[length - 1]
    if (action) showLastActionFor(action)
  },
  { immediate: true }
)

const syncLocalTile = (tile?: Tile | null) => {
  if (!tile) return
  localCurrentTile.value = { ...tile }
}

const syncLocalTileIfDiffers = (tile?: Tile | null) => {
  if (
    localCurrentTile.value?.id !== tile?.id ||
    localCurrentTile.value?.rotation !== tile?.rotation
  ) {
    syncLocalTile(tile)
  }
}

const followServerPlacingPoint = (point?: BoardCell | null) => {
  if (isSamePlacedPoint(point, hoveredTile.value)) return

  setHoveredTile(point)
  zoomToTile(hoveredTile.value)
}

watch(
  gameBoard,
  (gameBoard, oldGameBoard) => {
    if (!gameBoard.gameIsStarted) {
      updateSelectedPlacingPoint.cancel()
      return
    }

    const isNewGame =
      gameBoard.id !== oldGameBoard?.id || !oldGameBoard?.gameIsStarted

    if (isNewGame) {
      updateSelectedPlacingPoint.cancel()
      clearPlacementError()
      if (gameBoard.dragonMove) setHoveredTile(gameBoard.dragonPosition)
      if (hasPlacedPoint(gameBoard.placingPoint)) {
        setHoveredTile(gameBoard.placingPoint)
      }
      syncLocalTile(gameBoard.currentTile)
      return
    }

    if (gameBoard.dragonMove) setHoveredTile(gameBoard.dragonPosition)

    if (!gameBoard.isMyTurn) {
      clearPlacementError()
      followServerPlacingPoint(gameBoard.placingPoint)
      syncLocalTileIfDiffers(gameBoard.currentTile)
      return
    }

    if (localCurrentTile.value?.id !== gameBoard.currentTile?.id) {
      syncLocalTile(gameBoard.currentTile)
      // Новый тайл: прошлый выбор клетки неактуален, поэтому «призрак» и
      // причина отказа сбрасываются до нового выбора.
      clearPlacementError()
      setHoveredTile(null)
    }
  },
  { immediate: true }
)

const rotateLocalTile = (tile: Tile | null, direction: RotationDirection) => {
  if (!tile) return
  placementConflicts.value = []
  clearPlacementError()
  const newTile = rotateTileUtil(tile, direction)
  localCurrentTile.value = newTile
  void GameService.setCurrentTileRotation(newTile.rotation).catch((error) => {
    notifyError(error, t('action_rotate_tile_error'))
  })
}

onMounted(() => {
  document.addEventListener('keydown', onDocumentKeyDown)
})

onBeforeUnmount(() => {
  updateSelectedPlacingPoint.cancel()
  clearLastAction()
  document.removeEventListener('keydown', onDocumentKeyDown)
})
</script>
