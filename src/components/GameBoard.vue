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
  <Draggable
    v-if="
      !gameBoard.isPlacingFollower &&
      !gameBoard.dragonMove &&
      !gameBoard.princessChoice &&
      !gameBoard.gameIsEnded
    "
    is-none-style
    :initial-x="currentStatePosition.x"
    :initial-y="currentStatePosition.y"
    :disabled="!gameBoard.isMyTurn"
    draggable-id="tile-preview"
  >
    <div
      ref="ghostFrameRef"
      class="relative cursor-grab select-none active:cursor-grabbing"
    >
      <UButton
        v-if="gameBoard.isMyTurn"
        color="success"
        class="btn-primary-action absolute -top-[34px] left-1/2 z-10 min-h-8 -translate-x-1/2 cursor-pointer whitespace-nowrap rounded-lg px-3 py-1 text-[14px] font-semibold shadow-soft"
        @mousedown.stop
        @click="gameBoard.isMyTurn && placeTile(localCurrentTile, hoveredTile)"
      >
        Разместить
      </UButton>
      <div
        v-if="gameBoard.isMyTurn"
        class="absolute left-[-32px] top-1/2 -translate-y-1/2"
      >
        <UButton
          color="primary"
          icon="i-lucide-rotate-ccw"
          class="btn-primary-action flex h-7 w-7 cursor-pointer !p-0 text-white shadow-soft"
          :ui="{ leadingIcon: 'size-4' }"
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
        v-if="gameBoard.isMyTurn"
        class="absolute right-[-32px] top-1/2 -translate-y-1/2"
      >
        <UButton
          color="primary"
          icon="i-lucide-rotate-cw"
          class="btn-primary-action flex h-7 w-7 cursor-pointer !p-0 text-white shadow-soft"
          :ui="{ leadingIcon: 'size-4' }"
          @mousedown.stop
          @click.stop.prevent="
            rotateLocalTile(localCurrentTile, RotationDirection.Clockwise)
          "
        />
      </div>
      <div
        ref="ghostPreviewRef"
        class="origin-top-left bg-black/15 shadow-card ring-1 ring-gold/80"
        :style="{ width: `${TILE_SIZE}px`, height: `${TILE_SIZE}px` }"
      >
        <TileView
          :tile="localCurrentTile"
          :size="TILE_SIZE"
          class="h-full w-full"
        />
      </div>
    </div>
  </Draggable>
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
              hoveredTile?.rowIndex === rowIndex &&
              hoveredTile?.tileIndex === tileIndex
                ? 'tile-pulse'
                : '',
              conflictCells.has(`${rowIndex}:${tileIndex}`)
                ? 'tile-conflict'
                : '',
            ]"
            :data-row-index="rowIndex"
            :data-tile-index="tileIndex"
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
  <UButton
    v-if="!showLobby && canReset"
    color="primary"
    icon="i-lucide-minimize-2"
    title="Сбросить масштаб"
    class="btn-primary-action fixed bottom-4 right-4 z-[3000] min-h-10 cursor-pointer gap-2 rounded-lg px-3 py-2 text-sm font-semibold shadow-strong"
    @click="resetZoom"
  >
    100%
  </UButton>
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
import Draggable from './Draggable.vue'
import GamePlacingFollowers from './GamePlacingFollowers.vue'
import GamePrincessAndDragon from './GamePrincessAndDragon.vue'
import TileView from './TileView.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import GameService, { SocketAckError } from '../modules/GameService'
import { notifyError, throttle } from '../utils/common'
import notificationService from '../plugins/notification'
import { boardCellTestId } from '../data/testIds'
import { rotateTile as rotateTileUtil, TILE_SIZE } from '../utils/tiles'
import { findTileElement, scrollToTile } from '../utils/board'
import { useBoardPan } from '../composables/useBoardPan'
import { useGhostZoom } from '../composables/useGhostZoom'

const props = defineProps<{
  gameBoard: IGameBoard
  layoutEditMode: boolean
  showLobby: boolean
}>()
const { gameBoard, layoutEditMode, showLobby } = toRefs(props)

const {
  previewRef: ghostPreviewRef,
  frameRef: ghostFrameRef,
  applyZoom: applyGhostZoom,
} = useGhostZoom()

const {
  boardRef,
  planeRef,
  sizeBoxRef,
  isPanning,
  canReset,
  getZoom,
  resetZoom,
  onMouseDown,
  onClickCapture,
} = useBoardPan({ onZoomChange: applyGhostZoom })

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

const currentStatePosition = ref({ x: 0, y: 0 })

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

const localCurrentTile = ref<Tile | null>(null)

watch([ghostPreviewRef, ghostFrameRef], () => {
  applyGhostZoom(getZoom())
})

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

let gameUpdateTimeout: ReturnType<typeof setTimeout> | undefined

const clearGameUpdateTimeout = () => {
  clearTimeout(gameUpdateTimeout)
  gameUpdateTimeout = undefined
}

const followServerPlacingPoint = (point?: BoardCell | null) => {
  if (isSamePlacedPoint(point, hoveredTile.value)) return

  setHoveredTile(point)
  zoomToTile(hoveredTile.value)
  clearGameUpdateTimeout()
  gameUpdateTimeout = setTimeout(() => {
    gameUpdateTimeout = undefined
    const targetTileRect = findTileElement(
      hoveredTile.value.rowIndex ?? -1,
      hoveredTile.value.tileIndex ?? -1
    )?.getBoundingClientRect()

    if (targetTileRect) {
      currentStatePosition.value = {
        x: targetTileRect.left,
        y: targetTileRect.top,
      }
    }
  }, 1000)
}

watch(
  gameBoard,
  (gameBoard, oldGameBoard) => {
    if (!gameBoard.gameIsStarted) {
      updateSelectedPlacingPoint.cancel()
      clearGameUpdateTimeout()
      return
    }

    const isNewGame =
      gameBoard.id !== oldGameBoard?.id || !oldGameBoard?.gameIsStarted

    if (isNewGame) {
      updateSelectedPlacingPoint.cancel()
      clearGameUpdateTimeout()
      if (gameBoard.dragonMove) setHoveredTile(gameBoard.dragonPosition)
      if (hasPlacedPoint(gameBoard.placingPoint)) {
        setHoveredTile(gameBoard.placingPoint)
      }
      syncLocalTile(gameBoard.currentTile)
      return
    }

    if (gameBoard.dragonMove) setHoveredTile(gameBoard.dragonPosition)

    if (!gameBoard.isMyTurn) {
      followServerPlacingPoint(gameBoard.placingPoint)
      syncLocalTileIfDiffers(gameBoard.currentTile)
      return
    }

    if (localCurrentTile.value?.id !== gameBoard.currentTile?.id) {
      syncLocalTile(gameBoard.currentTile)
      if (hasPlacedPoint(gameBoard.placingPoint)) {
        setHoveredTile(gameBoard.placingPoint)
      }
    }
  },
  { immediate: true }
)

const rotateLocalTile = (tile: Tile | null, direction: RotationDirection) => {
  if (!tile) return
  placementConflicts.value = []
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
    notificationService.error('Выберите клетку для размещения')
    return
  }

  placementConflicts.value = []
  try {
    await GameService.placeTile(tile, { rowIndex, tileIndex })
  } catch (error: unknown) {
    if (error instanceof SocketAckError) {
      placementConflicts.value = error.conflicts
    }
    notifyError(error, 'Произошла ошибка при размещении плитки')
  }
}

onMounted(() => {
  currentStatePosition.value = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }
})

onBeforeUnmount(() => {
  updateSelectedPlacingPoint.cancel()
  clearGameUpdateTimeout()
})
</script>
