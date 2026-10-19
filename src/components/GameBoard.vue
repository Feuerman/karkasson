<template>
  <GameControls :game-board="gameBoard" :drag-enabled="layoutEditMode" />
  <GameActionsHistory :game-board="gameBoard" :drag-enabled="layoutEditMode" />
  <GamePlacingFollowers
    :game-board="gameBoard"
    :drag-enabled="layoutEditMode"
  />
  <GamePrincessAndDragon
    :game-board="gameBoard"
    :drag-enabled="layoutEditMode"
  />
  <GameAbbotRecall :game-board="gameBoard" :drag-enabled="layoutEditMode" />
  <div
    ref="boardRef"
    class="board-surface min-h-0 w-full flex-1 select-none overflow-auto rounded-xl shadow-[inset_0_0_30px_rgba(0,0,0,0.3)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    :class="isPanning ? 'cursor-grabbing' : 'cursor-grab'"
    @mousedown="onMouseDown"
    @click.capture="onClickCapture"
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
            class="relative flex-shrink-0 rounded-xl border border-black/10 bg-black/[0.04] shadow-[0_6px_14px_-6px_rgba(0,0,0,0.35)] transition-all duration-200"
            :style="{ width: `${TILE_SIZE}px`, height: `${TILE_SIZE}px` }"
            :class="[
              gameBoard.tilePlacesStats?.[rowIndex]?.[tileIndex]
                ? 'border-black/15'
                : '',
              isSelectedCell(rowIndex, tileIndex)
                ? isGhostCell(rowIndex, tileIndex)
                  ? 'tile-selected'
                  : 'tile-pulse'
                : '',
              conflictCells.has(`${rowIndex}:${tileIndex}`)
                ? 'tile-conflict'
                : '',
              isAvailableCell(rowIndex, tileIndex) ? 'tile-available' : '',
            ]"
            :data-row-index="rowIndex"
            :data-tile-index="tileIndex"
            :data-available="isAvailableCell(rowIndex, tileIndex) || undefined"
            :data-testid="boardCellTestId(rowIndex, tileIndex)"
            @click="handleTileClick(rowIndex, tileIndex)"
          >
            <TileView
              :tile="gameBoard.tilePlacesStats?.[rowIndex]?.[tileIndex]"
              :followers="
                followersByCell[rowIndex]?.[tileIndex] ?? EMPTY_CELL_FOLLOWERS
              "
              :players="gameBoard.players"
              :size="TILE_SIZE"
            />
            <div
              v-if="isGhostCell(rowIndex, tileIndex)"
              class="absolute inset-0"
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
                  title="Повернуть тайл против часовой стрелки"
                  aria-label="Повернуть тайл против часовой стрелки"
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
                  title="Повернуть тайл по часовой стрелке"
                  aria-label="Повернуть тайл по часовой стрелке"
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
              aria-label="Дракон"
            >
              🐉
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div
    v-if="canShowPlacementUi"
    class="fixed bottom-6 left-1/2 z-[3000] flex -translate-x-1/2 flex-col items-center gap-3"
  >
    <div
      v-if="placementError"
      role="alert"
      :data-testid="TEST_IDS.placementError"
      class="max-w-[min(92vw,32rem)] rounded-xl border border-danger/70 bg-danger/15 px-4 py-2 text-sm leading-snug font-medium text-danger-dark shadow-soft backdrop-blur-sm"
    >
      <span class="flex items-start gap-2">
        <UIcon name="i-lucide-alert-triangle" class="mt-0.5 h-4 w-4 shrink-0" />
        <span>{{ placementError }}</span>
      </span>
    </div>
    <div
      class="flex flex-col items-center gap-2"
      :data-testid="TEST_IDS.pendingTilePreview"
    >
      <div class="relative">
        <div class="absolute left-[-34px] top-1/2 -translate-y-1/2">
          <UButton
            color="primary"
            icon="i-lucide-rotate-ccw"
            class="btn-primary-action flex h-8 w-8 cursor-pointer !p-0 text-white shadow-soft"
            :ui="{ leadingIcon: 'size-4' }"
            title="Повернуть тайл против часовой стрелки"
            aria-label="Повернуть тайл против часовой стрелки"
            :data-testid="TEST_IDS.rotateTileCounterclockwise"
            @mousedown.stop
            @click.stop.prevent="
              rotateLocalTile(
                localCurrentTile,
                RotationDirection.Counterclockwise
              )
            "
          />
        </div>
        <div
          class="overflow-hidden rounded-xl shadow-strong ring-1 ring-black/10"
          :style="{ width: `${TILE_SIZE}px`, height: `${TILE_SIZE}px` }"
        >
          <TileView
            :tile="localCurrentTile"
            :size="TILE_SIZE"
            class="h-full w-full"
          />
        </div>
        <div class="absolute right-[-34px] top-1/2 -translate-y-1/2">
          <UButton
            color="primary"
            icon="i-lucide-rotate-cw"
            class="btn-primary-action flex h-8 w-8 cursor-pointer !p-0 text-white shadow-soft"
            :ui="{ leadingIcon: 'size-4' }"
            title="Повернуть тайл по часовой стрелке"
            aria-label="Повернуть тайл по часовой стрелке"
            :data-testid="TEST_IDS.rotateTileClockwise"
            @mousedown.stop
            @click.stop.prevent="
              rotateLocalTile(localCurrentTile, RotationDirection.Clockwise)
            "
          />
        </div>
      </div>
      <span
        class="rounded-lg bg-black/50 px-3 py-1 text-xs font-medium whitespace-nowrap text-amber-50 backdrop-blur-sm"
      >
        {{ placementHint }}
      </span>
    </div>
    <UButton
      color="success"
      icon="i-lucide-map-pin"
      :disabled="!hasSelectedCell"
      :title="
        hasSelectedCell
          ? 'Разместить тайл на выбранной клетке'
          : 'Сначала выберите клетку на поле'
      "
      class="btn-primary-action min-h-12 cursor-pointer whitespace-nowrap rounded-xl px-6 py-2 text-base font-semibold shadow-strong"
      :data-testid="TEST_IDS.placeTile"
      @click="placeTile(localCurrentTile, hoveredTile)"
    >
      Разместить
    </UButton>
  </div>
  <div
    v-if="!showLobby"
    class="fixed bottom-4 right-4 z-[3000] flex items-center gap-1 rounded-xl border border-gold-dark bg-surface/90 p-1 shadow-strong backdrop-blur"
  >
    <UButton
      color="primary"
      icon="i-lucide-zoom-out"
      title="Отдалить"
      aria-label="Отдалить доску"
      class="btn-secondary h-8 w-8 cursor-pointer !p-0"
      :ui="{ leadingIcon: 'size-4' }"
      :data-testid="TEST_IDS.zoomOut"
      @click="zoomOut"
    />
    <button
      type="button"
      title="Сбросить масштаб"
      class="min-w-[3.25rem] cursor-pointer rounded-md px-1 py-0.5 text-sm font-semibold tabular-nums text-wood-dark transition-colors hover:bg-gold/20"
      :data-testid="TEST_IDS.zoomValue"
      @click="resetZoom"
    >
      {{ zoomPercent }}%
    </button>
    <UButton
      color="primary"
      icon="i-lucide-zoom-in"
      title="Приблизить"
      aria-label="Приблизить доску"
      class="btn-secondary h-8 w-8 cursor-pointer !p-0"
      :ui="{ leadingIcon: 'size-4' }"
      :data-testid="TEST_IDS.zoomIn"
      @click="zoomIn"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, toRefs, watch } from 'vue'
import type { PlacedFollower } from '@server/modules/types'
import {
  BOARD_GRID_SIZE,
  RotationDirection,
  type PlacementConflict,
  type Tile,
} from '@server/modules/types'
import type { BoardCell, IGameBoard } from '../types/game'
import GameActionsHistory from './GameActionsHistory'
import GameAbbotRecall from './GameAbbotRecall.vue'
import GameControls from './GameControls.vue'
import GamePlacingFollowers from './GamePlacingFollowers.vue'
import GamePrincessAndDragon from './GamePrincessAndDragon.vue'
import TileView from './TileView.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import GameService, { SocketAckError } from '../modules/GameService'
import { errorMessage, notifyError, throttle } from '../utils/common'
import notificationService from '../plugins/notification'
import { boardCellTestId, TEST_IDS } from '../data/testIds'
import { rotateTile as rotateTileUtil, TILE_SIZE } from '../utils/tiles'
import { scrollToTile } from '../utils/board'
import { boardCellKey, buildAvailableCells } from '../utils/availableCells'
import { useBoardPan } from '../composables/useBoardPan'

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
const followersByCell = ref<PlacedFollower[][][]>([])

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

/** Клетка доски: выбрана игроком или пришла с сервера. */
const hoveredTile = ref<BoardCell>({})

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

/** Панель размещения видна только в фазе раскладки тайла своего хода. */
const canShowPlacementUi = computed(
  () =>
    gameBoard.value.isMyTurn &&
    !gameBoard.value.isPlacingFollower &&
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

const placementHint = computed(() =>
  hasSelectedCell.value
    ? 'Разместите тайл или поверните его'
    : 'Выберите клетку на поле'
)

/** Превью рисуется прямо в выбранной клетке доски, поэтому двигается вместе с ней. */
const isGhostCell = (rowIndex: number, tileIndex: number) =>
  canShowPlacementUi.value &&
  hasSelectedCell.value &&
  hoveredTile.value.rowIndex === rowIndex &&
  hoveredTile.value.tileIndex === tileIndex

/** Выбрана ли клетка доски игроком. */
const isSelectedCell = (rowIndex: number, tileIndex: number): boolean =>
  hoveredTile.value.rowIndex === rowIndex &&
  hoveredTile.value.tileIndex === tileIndex

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
      notifyError(error, 'Не удалось выбрать клетку')
    })
  },
  300
)

const handleTileClick = (rowIndex: number, tileIndex: number) => {
  if (gameBoard.value.isMyTurn) {
    if (gameBoard.value.dragonMove) {
      void GameService.moveDragon({ rowIndex, tileIndex }).catch((error) => {
        notifyError(error, 'Не удалось переместить дракона')
      })
      return
    }

    placementConflicts.value = []
    clearPlacementError()
    setHoveredTile({ rowIndex, tileIndex })
    updateSelectedPlacingPoint({ rowIndex, tileIndex })
  }
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
  scrollToTile(rowIndex, tileIndex)
}

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
    notifyError(error, 'Не удалось повернуть плитку на сервере')
  })
}

const placeTile = async (
  tile: Tile | null,
  { rowIndex, tileIndex }: { rowIndex?: number; tileIndex?: number }
) => {
  if (!tile) return
  if (typeof rowIndex !== 'number' || typeof tileIndex !== 'number') {
    notificationService.warning('Сначала выберите клетку для размещения')
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
    placementError.value = errorMessage(
      error,
      'Произошла ошибка при размещении плитки'
    )
    notifyError(error, 'Произошла ошибка при размещении плитки')
  }
}

onBeforeUnmount(() => {
  updateSelectedPlacingPoint.cancel()
})
</script>
