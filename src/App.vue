<template>
  <UApp class="h-full">
    <UToaster />
    <ToastBridge />
    <div class="relative flex h-full flex-col bg-surface-muted text-text">
      <ReconnectingOverlay
        v-if="playersReconnectProcess"
        :players="reconnectingPlayers"
      />
      <GameLobby
        v-if="showLobby"
        :games-list="games"
        :players="playersList"
        :current-game="currentGame"
        :is-connected="GameService.isConnected.value"
        :is-creator="isLobbyCreator"
        :is-games-list-loading="isGamesListLoading"
        :device-id="GameService.deviceId"
        @start-game="startGame"
        @rejoin-game="rejoinGame"
        @join-game="joinGame"
        @leave-game="leaveGame"
        @create-game="createGame"
        @add-player="addPlayer"
        @remove-player="removePlayer"
      />
      <GameControls :game-board="gameState" :drag-enabled="isLayoutEditMode" />
      <GameActionsHistory
        :game-board="gameState"
        :drag-enabled="isLayoutEditMode"
      />
      <GamePlacingFollowers
        :game-board="gameState"
        :drag-enabled="isLayoutEditMode"
      />
      <GamePrincessAndDragon
        :game-board="gameState"
        :drag-enabled="isLayoutEditMode"
      />
      <GameAbbotRecall
        :game-board="gameState"
        :drag-enabled="isLayoutEditMode"
      />
      <Draggable
        v-if="
          !gameState.isPlacingFollower &&
          !gameState.dragonMove &&
          !gameState.princessChoice &&
          !gameState.gameIsEnded
        "
        is-none-style
        :initial-x="currentStatePosition.x"
        :initial-y="currentStatePosition.y"
        :disabled="!gameState.isMyTurn"
        draggable-id="tile-preview"
      >
        <div
          ref="ghostFrameRef"
          class="relative cursor-grab select-none active:cursor-grabbing"
        >
          <UButton
            v-if="gameState.isMyTurn"
            color="success"
            class="btn-primary-action absolute -top-[34px] left-1/2 z-10 min-h-8 -translate-x-1/2 cursor-pointer whitespace-nowrap rounded-lg px-3 py-1 text-[14px] font-semibold shadow-soft"
            @mousedown.stop
            @click="
              gameState.isMyTurn && placeTile(localCurrentTile, hoveredTile)
            "
          >
            Разместить
          </UButton>
          <div
            v-if="gameState.isMyTurn"
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
            v-if="gameState.isMyTurn"
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
                v-for="(tile, tileIndex) in row"
                :key="tileIndex"
                class="relative flex-shrink-0 rounded-xl border border-black/10 bg-black/[0.04] shadow-[0_6px_14px_-6px_rgba(0,0,0,0.35)] transition-all duration-200"
                :style="{ width: `${TILE_SIZE}px`, height: `${TILE_SIZE}px` }"
                :class="[
                  gameState.tilePlacesStats?.[rowIndex]?.[tileIndex]
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
                  :tile="gameState.tilePlacesStats?.[rowIndex]?.[tileIndex]"
                  :followers="
                    followersByCell[rowIndex]?.[tileIndex] ??
                    EMPTY_CELL_FOLLOWERS
                  "
                  :players="gameState.players"
                  :size="TILE_SIZE"
                />
                <div
                  v-if="
                    gameState.dragonPosition?.rowIndex === rowIndex &&
                    gameState.dragonPosition?.tileIndex === tileIndex
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
      <BottomToolbar
        :items="menuItems"
        :show-lobby="showLobby"
        :layout-edit-mode="isLayoutEditMode"
        @select="onMenuSelect"
        @toggle-layout-edit="isLayoutEditMode = !isLayoutEditMode"
        @exit="goInLobby"
      />
      <RulesPanel
        v-if="rulesDocument"
        v-model:open="showRules"
        :doc="rulesDocument"
      />
    </div>
  </UApp>
</template>

<script lang="ts" setup>
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import TileView from './components/TileView.vue'
import GameControls from './components/GameControls.vue'
import GameActionsHistory from './components/GameActionsHistory'
import Draggable from './components/Draggable.vue'
import GamePlacingFollowers from './components/GamePlacingFollowers.vue'
import GameAbbotRecall from './components/GameAbbotRecall.vue'
import GamePrincessAndDragon from './components/GamePrincessAndDragon.vue'
import type { GameMenuItem } from './components/GameMenu.vue'
import BottomToolbar from './components/BottomToolbar.vue'
import ReconnectingOverlay from './components/ReconnectingOverlay.vue'
import UApp from '@nuxt/ui/components/App.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UToaster from '@nuxt/ui/components/Toaster.vue'
import ToastBridge from './components/ToastBridge.vue'
import { notifyError, throttle } from './utils/common'
import { boardCellTestId } from './data/testIds'
import { rotateTile as rotateTileUtil, TILE_SIZE } from './utils/tiles'
import { findTileElement, scrollToTile } from './utils/board'
import GameLobby from './components/GameLobby'
import GameService, { SocketAckError } from './modules/GameService'
import type { CreateGameOptions } from './modules/GameService'
import notificationService from './plugins/notification'
import { useBoardPan } from './composables/useBoardPan'
import { useGhostZoom } from './composables/useGhostZoom'
import type { PlacedFollower } from '@server/modules/types'
import type { IGame, IGameBoard, LobbyGame } from './types/game'
import type { GameSummary } from '@server/services/GameService'
import {
  BOARD_GRID_SIZE,
  RotationDirection,
  SocketEvents,
  type Tile,
  type PlacementConflict,
  type Player,
} from '@server/modules/types'
import type { RulesDocument } from './rules/types'

const RulesPanel = defineAsyncComponent(
  () => import('./components/rules/RulesPanel.vue')
)

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
} = useBoardPan({
  onZoomChange: applyGhostZoom,
})

const gameState = ref<IGameBoard>({} as IGameBoard)

const gridDimensions = computed(
  () => gameState.value.gridSize ?? BOARD_GRID_SIZE
)
const defaultGrid = computed(() =>
  Array.from({ length: gridDimensions.value[1] }, () =>
    Array.from({ length: gridDimensions.value[0] }, () => null)
  )
)

const EMPTY_CELL_FOLLOWERS: PlacedFollower[] = []
const followersByCell = ref<PlacedFollower[][][]>([])

watch(
  () => gameState.value.placedFollowers,
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
          (f) => f.point.y === r && f.point.x === c
        )
        const prevCell = prev[r]?.[c]
        if (
          prevCell &&
          prevCell.length === cellFollowers.length &&
          prevCell.every((f, i) => f === cellFollowers[i])
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

// Размеры окна известны только после монтирования: начальная позиция
// превью выставляется в `onMounted`.
const currentStatePosition = ref({ x: 0, y: 0 })

/** Клетка доски: выбрана игроком или пришла с сервера. */
type PlacedPoint = { rowIndex?: number; tileIndex?: number }

const hoveredTile = ref<PlacedPoint>({})

const setHoveredTile = (point?: PlacedPoint | null) => {
  hoveredTile.value = {
    rowIndex: point?.rowIndex,
    tileIndex: point?.tileIndex,
  }
}

const hasPlacedPoint = (
  point?: PlacedPoint | null
): point is { rowIndex: number; tileIndex: number } =>
  typeof point?.rowIndex === 'number' && typeof point?.tileIndex === 'number'

const isSamePlacedPoint = (
  point: PlacedPoint | null | undefined,
  other: PlacedPoint
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

const showLobby = ref(true)
const isLayoutEditMode = ref(false)

// Превью монтируется и исчезает вместе с игровыми фазами, поэтому масштаб
// доски переносится на него каждый раз, когда элементы появились.
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
  if (gameState.value.isMyTurn) {
    if (gameState.value.dragonMove) {
      void GameService.moveDragon({ rowIndex, tileIndex }).catch((error) => {
        notifyError(error, 'Не удалось переместить дракона')
      })
      return
    }

    placementConflicts.value = []
    setHoveredTile({ rowIndex, tileIndex })

    updateSelectedPlacingPoint({
      rowIndex,
      tileIndex,
    })
  }
}

watch(
  () => gameState.value.lastPlacement,
  (value, oldValue) => {
    if (
      value?.rowIndex !== oldValue?.rowIndex ||
      value?.tileIndex !== oldValue?.tileIndex
    ) {
      nextTick(() => {
        zoomToTile(value)
      })
    }
  },
  { immediate: true, deep: true }
)

const zoomToTile = ({ rowIndex, tileIndex }: PlacedPoint = {}) => {
  if (rowIndex === undefined || tileIndex === undefined) {
    return
  }
  scrollToTile(rowIndex, tileIndex)
}

/** Доска получает серверный снимок; возвращает, чей сейчас ход. */
const applyGameState = (game: IGame): boolean => {
  const isMyTurn = game.currentPlayer?.socketId === GameService.socket?.id
  if (game.dragonMove) {
    setHoveredTile(game.dragonPosition)
  }
  gameState.value = { ...game, isMyTurn } as IGameBoard
  return isMyTurn
}

const syncLocalTile = (tile?: Tile | null) => {
  if (!tile) return
  localCurrentTile.value = { ...tile }
}

/** Превью догоняет сервер, только если сменился тайл или его поворот. */
const syncLocalTileIfDiffers = (tile?: Tile | null) => {
  if (
    localCurrentTile.value?.id !== tile?.id ||
    localCurrentTile.value?.rotation !== tile?.rotation
  ) {
    syncLocalTile(tile)
  }
}

let activeGameId: string | undefined
let gameUpdateTimeout: ReturnType<typeof setTimeout> | undefined
let cleanupSocketListeners: (() => void) | undefined

const clearGameUpdateTimeout = () => {
  clearTimeout(gameUpdateTimeout)
  gameUpdateTimeout = undefined
}

/**
 * Во время чужого хода следуем за серверной точкой: подсвечиваем клетку,
 * прокручиваем к ней, а когда отрисовка догнала доску — возвращаем превью
 * тайла к этой клетке.
 */
const followServerPlacingPoint = (point?: PlacedPoint | null) => {
  if (isSamePlacedPoint(point, hoveredTile.value)) {
    return
  }

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

const onGameStart = (gameData: IGame) => {
  if (activeGameId !== gameData.id) {
    activeGameId = gameData.id
    updateSelectedPlacingPoint.cancel()
    clearGameUpdateTimeout()
  }

  applyGameState(gameData)

  showLobby.value = false

  if (hasPlacedPoint(gameData.placingPoint)) {
    setHoveredTile(gameData.placingPoint)
  }

  syncLocalTile(gameData.currentTile)

  if (gameData.id) {
    handleGameCreated(gameData.id)
  }
}

const onGameUpdated = (updatedGame: IGame) => {
  if (!updatedGame.gameIsStarted) {
    playersList.value = updatedGame.players
    return
  }

  if (!gameState.value.gameIsStarted || activeGameId !== updatedGame.id) {
    onGameStart(updatedGame)
    return
  }

  if (!applyGameState(updatedGame)) {
    followServerPlacingPoint(updatedGame.placingPoint)
    syncLocalTileIfDiffers(updatedGame.currentTile)
    return
  }

  // Новый тайл на моём ходу: обновляем превью и показываем выбранную на
  // сервере клетку.
  if (localCurrentTile.value?.id !== updatedGame.currentTile?.id) {
    syncLocalTile(updatedGame.currentTile)

    if (hasPlacedPoint(updatedGame.placingPoint)) {
      setHoveredTile(updatedGame.placingPoint)
    }
  }
}

const handleGameCreated = (gameId: string) => {
  localStorage.setItem('lastGameId', gameId)
}

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
  } catch (e: unknown) {
    if (e instanceof SocketAckError) {
      placementConflicts.value = e.conflicts
    }
    notifyError(e, 'Произошла ошибка при размещении плитки')
  }
}

const updateLocalGamesList = (gamesList: GameSummary[]) => {
  const savedGameId = localStorage.getItem('lastGameId')

  games.value = gamesList.map((game) => ({
    ...game,
    isLastGame: game.id === savedGameId,
  }))
}

const getGamesList = async () => {
  isGamesListLoading.value = true
  try {
    const gamesList = await GameService.getGamesList()
    updateLocalGamesList(gamesList)
  } catch (error) {
    notifyError(error, 'Произошла ошибка при получении списка игр')
  } finally {
    isGamesListLoading.value = false
  }
}

/**
 * Общая часть входа и переподключения: начатая партия открывает доску,
 * иначе остаёмся в лобби комнаты.
 */
const enterGame = (game: IGame) => {
  if (game.gameIsStarted) {
    showLobby.value = false
    return
  }
  currentGame.value = game
  playersList.value = game.players
}

const joinGame = async (gameId: string) => {
  try {
    enterGame(await GameService.joinGame(gameId))
  } catch (error) {
    notifyError(error)
  }
}

const rejoinGame = async (gameId: string) => {
  try {
    enterGame(await GameService.rejoinGame(gameId))
  } catch (error) {
    notifyError(error)
  }
}

/** Сбрасывает локальное состояние партии перед возвратом в лобби. */
const clearSession = () => {
  activeGameId = undefined
  updateSelectedPlacingPoint.cancel()
  clearGameUpdateTimeout()
  playersList.value = []
  currentGame.value = null
}

const leaveGame = async () => {
  try {
    await GameService.leaveGame()
    clearSession()
    getGamesList()
  } catch (error) {
    notifyError(error)
  }
}

const goInLobby = async () => {
  try {
    await GameService.leaveGame()
    clearSession()
    showLobby.value = true
    gameState.value = {} as IGameBoard
    getGamesList()
  } catch (error) {
    notifyError(error)
  }
}

const createGame = async (options: CreateGameOptions) => {
  try {
    const game = await GameService.createGame(options)
    currentGame.value = game
    playersList.value = game.players
  } catch (error) {
    notifyError(error)
  }
}

const addPlayer = async (name: string, index: number) => {
  try {
    await GameService.addPlayer({ name, index })
  } catch (error) {
    notifyError(error)
  }
}

const removePlayer = async (index: number, keepAsComputer: boolean) => {
  try {
    await GameService.removePlayer(index, keepAsComputer)
  } catch (error) {
    notifyError(error)
  }
}

const startGame = async () => {
  try {
    onGameStart(await GameService.startGame())
  } catch (error) {
    notifyError(error)
  }
}

const isLobbyCreator = computed(() => {
  const creator = currentGame.value?.players[0]
  if (!creator) return false

  return Boolean(
    (creator.deviceId && creator.deviceId === GameService.deviceId) ||
    (creator.socketId && creator.socketId === GameService.socketId.value)
  )
})

const playersReconnectProcess = computed(() => {
  return !gameState.value.gameIsEnded && reconnectingPlayers.value?.length > 0
})

const reconnectingPlayers = computed(() => {
  return gameState.value.players?.filter(
    (player) => !player.socketId && player.deviceId
  )
})

const games = ref<LobbyGame[]>([])
const isGamesListLoading = ref(true)
const playersList = ref<Player[]>([])
const currentGame = ref<IGame | null>(null)

const showRules = ref(false)
const rulesDocument = ref<RulesDocument | null>(null)
const menuItems: GameMenuItem[] = [
  { id: 'rules', label: 'Правила игры', icon: 'i-lucide-circle-help' },
]

const onMenuSelect = async (id: string) => {
  if (id === 'rules') {
    try {
      const { baseGameRules } = await import('./rules/baseGame')
      rulesDocument.value = baseGameRules
      showRules.value = true
    } catch (error: unknown) {
      notifyError(error)
    }
  }
}

onBeforeUnmount(() => {
  cleanupSocketListeners?.()
  cleanupSocketListeners = undefined
  updateSelectedPlacingPoint.cancel()
  clearGameUpdateTimeout()
})

onMounted(() => {
  currentStatePosition.value = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }

  GameService.connect()

  const unsubscribeGameUpdated = GameService.onGameUpdated(onGameUpdated)
  const onGamesListUpdated = (gamesList: GameSummary[]) => {
    updateLocalGamesList(gamesList)
  }
  const onConnect = () => {
    void getGamesList()
  }

  // Подписки идут через сервис, чтобы пережить переподключение сокета.
  const unsubscribeGamesList = GameService.onSocketEvent(
    SocketEvents.UpdateGamesList,
    onGamesListUpdated
  )
  const unsubscribeConnect = GameService.onSocketEvent('connect', onConnect)

  cleanupSocketListeners = () => {
    unsubscribeGameUpdated()
    unsubscribeGamesList()
    unsubscribeConnect()
  }
})
</script>
