<template>
  <UApp class="h-full">
    <UToaster />
    <ToastBridge />
    <div class="relative flex h-full flex-col bg-surface-muted text-text">
      <div
        v-if="playersReconnectProcess"
        class="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-black/80 text-lg font-medium text-white"
      >
        <div class="flex flex-col items-center gap-2.5">
          <UIcon
            name="i-lucide-loader-circle"
            class="h-10 w-10 animate-spin text-white"
          />
          <div>Ожидание подключения игроков</div>
        </div>
        <div class="flex flex-wrap justify-center gap-2.5">
          <UBadge
            v-for="player in reconnectingPlayers"
            :key="player.id"
            variant="subtle"
            class="!bg-white/20 !text-white"
          >
            {{ player.name }}
          </UBadge>
        </div>
      </div>
      <GameLobby
        v-if="showLobby"
        :game="gameState"
        :games-list="games"
        :players="playersList"
        :current-game="currentGame"
        @start-game="showLobby = false"
        @game-started="onGameStart"
        @rejoin-game="rejoinGame"
        @join-game="joinGame"
        @leave-game="leaveGame"
        @create-game="createGame"
        @update-games-list="getGamesList"
      />
      <GameControls :game-board="gameState" :drag-enabled="isLayoutEditMode" />
      <GameActionsHistory
        :game-board="gameState"
        :drag-enabled="isLayoutEditMode"
        @highlight-object="highlightObject"
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
            class="h-[115px] w-[115px] origin-top-left bg-black/15 shadow-card ring-1 ring-gold/80"
          >
            <TileView
              :tile="localCurrentTile"
              :size="115"
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
              gridTemplateColumns: `repeat(${gridDimensions[0]}, 115px)`,
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
                class="relative h-[115px] w-[115px] flex-shrink-0 rounded-xl border border-black/10 bg-black/[0.04] shadow-[0_6px_14px_-6px_rgba(0,0,0,0.35)] transition-all duration-200"
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
                  :followers="gameState.placedFollowers"
                  :players="gameState.players"
                  :highlight-points="highlightPoints"
                  :size="115"
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
      <div class="fixed bottom-4 left-4 z-[9998] flex items-center gap-2">
        <GameMenu :items="menuItems" @select="onMenuSelect" />
        <UButton
          v-if="!showLobby"
          color="primary"
          :icon="
            isLayoutEditMode ? 'i-lucide-check' : 'i-lucide-panels-top-left'
          "
          :aria-pressed="isLayoutEditMode"
          :aria-label="
            isLayoutEditMode ? 'Завершить настройку окон' : 'Настроить окна'
          "
          class="btn-primary-action min-h-11 shrink-0 cursor-pointer gap-2 rounded-full px-3 font-semibold shadow-soft sm:px-4"
          @click="isLayoutEditMode = !isLayoutEditMode"
        >
          <span class="hidden sm:inline">
            {{ isLayoutEditMode ? 'Готово' : 'Настроить окна' }}
          </span>
        </UButton>
        <UButton
          v-if="!showLobby"
          color="primary"
          icon="i-lucide-arrow-left"
          :data-testid="TEST_IDS.gameExit"
          aria-label="Выйти из игры"
          title="Выйти из игры"
          class="btn-primary-action min-h-11 shrink-0 cursor-pointer gap-2 rounded-full px-3 font-semibold shadow-soft sm:px-4"
          @click="goInLobby"
        >
          <span class="hidden sm:inline">Выйти из игры</span>
        </UButton>
      </div>
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
import GameMenu, { type GameMenuItem } from './components/GameMenu.vue'
import UApp from '@nuxt/ui/components/App.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UToaster from '@nuxt/ui/components/Toaster.vue'
import ToastBridge from './components/ToastBridge.vue'
import { notifyError, throttle } from './utils/common'
import { TEST_IDS, boardCellTestId } from './data/testIds'
import { rotateTile as rotateTileUtil, TILE_SIZE } from './utils/tiles'
import { findTileElement, scrollToTile } from './utils/board'
import GameLobby from './components/GameLobby'
import GameService, { SocketAckError } from './modules/GameService'
import type { CreateGameOptions } from './modules/GameService'
import notificationService from './plugins/notification'
import { useBoardPan } from './composables/useBoardPan'
import type { IGame, IGameBoard, ITile, LobbyGame } from './types/game'
import type { GameSummary } from '@server/services/GameService'
import {
  RotationDirection,
  SideName,
  SocketEvents,
  TileSideType,
  type PlacementConflict,
  type Player,
  type Point,
} from '@server/modules/types'
import type { RulesDocument } from './rules/types'

const RulesPanel = defineAsyncComponent(
  () => import('./components/rules/RulesPanel.vue')
)

const ghostPreviewRef = ref<HTMLElement | null>(null)
const ghostFrameRef = ref<HTMLElement | null>(null)

function applyGhostZoom(zoom: number) {
  if (ghostPreviewRef.value) {
    ghostPreviewRef.value.style.transform = `scale(${zoom})`
  }

  if (ghostFrameRef.value) {
    ghostFrameRef.value.style.width = `${TILE_SIZE * zoom}px`
    ghostFrameRef.value.style.height = `${TILE_SIZE * zoom}px`
  }
}

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

const gridDimensions = computed(() => gameState.value.gridSize ?? [30, 30])
const defaultGrid = computed(() =>
  Array.from({ length: gridDimensions.value[1] ?? 30 }, () =>
    Array.from({ length: gridDimensions.value[0] ?? 30 }, () => null)
  )
)

const currentStatePosition = ref({
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
})

const hoveredTile = ref({
  rowIndex: undefined as number | undefined,
  tileIndex: undefined as number | undefined,
})

const placementConflicts = ref<PlacementConflict[]>([])

const conflictCells = computed(
  () =>
    new Set(
      placementConflicts.value.map(
        (conflict) => `${conflict.rowIndex}:${conflict.tileIndex}`
      )
    )
)

const EMPTY_TILE: ITile = {
  id: '',
  rotation: 0,
  sides: {
    [SideName.North]: TileSideType.Field,
    [SideName.West]: TileSideType.Field,
    [SideName.South]: TileSideType.Field,
    [SideName.East]: TileSideType.Field,
  },
  followers: [],
  imgUrl: '',
  name: '',
  description: '',
}

const localCurrentTile = ref<ITile>({ ...EMPTY_TILE })

const showLobby = ref(true)
const isLayoutEditMode = ref(false)

watch(
  () => [gameState.value.isPlacingFollower, localCurrentTile.value.id],
  () => {
    nextTick(() => {
      applyGhostZoom(getZoom())
    })
  }
)

const updateSelectedPlacingPoint = throttle(
  async (value: { rowIndex: number; tileIndex: number }) => {
    await GameService.selectPlacingPoint(value)
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
    hoveredTile.value.rowIndex = rowIndex
    hoveredTile.value.tileIndex = tileIndex

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

const zoomToTile = ({
  rowIndex,
  tileIndex,
}: { rowIndex?: number; tileIndex?: number } = {}) => {
  if (rowIndex === undefined || tileIndex === undefined) {
    return
  }
  scrollToTile(rowIndex, tileIndex)
}

const highlightPoints = ref<Point[]>([])
const highlightObject = (objectData: { points?: Point[] }) => {
  highlightPoints.value = objectData.points ?? []
}

const applyGameState = (game: IGame): boolean => {
  const isMyTurn = game.currentPlayer?.socketId === GameService.socket?.id
  if (game.dragonMove) {
    hoveredTile.value = {
      rowIndex: game.dragonPosition?.rowIndex,
      tileIndex: game.dragonPosition?.tileIndex,
    }
  }
  gameState.value = { ...game, isMyTurn } as IGameBoard
  return isMyTurn
}

const syncLocalTile = (tile?: ITile | null) => {
  if (!tile) return
  localCurrentTile.value = { ...tile } as ITile
}

let activeGameId: string | undefined
let gameUpdateTimeout: ReturnType<typeof setTimeout> | undefined
let cleanupSocketListeners: (() => void) | undefined

const clearGameUpdateTimeout = () => {
  clearTimeout(gameUpdateTimeout)
  gameUpdateTimeout = undefined
}

const onGameStart = (gameData: IGame) => {
  if (activeGameId !== gameData.id) {
    activeGameId = gameData.id
    updateSelectedPlacingPoint.cancel()
    clearGameUpdateTimeout()
  }

  applyGameState(gameData)

  showLobby.value = false

  if (
    gameData.placingPoint?.rowIndex !== undefined &&
    gameData.placingPoint?.tileIndex !== undefined
  ) {
    hoveredTile.value = gameData.placingPoint || {
      rowIndex: undefined,
      tileIndex: undefined,
    }
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

  const isMyTurn = applyGameState(updatedGame)

  if (
    !isMyTurn &&
    (updatedGame.placingPoint?.rowIndex !== hoveredTile.value.rowIndex ||
      updatedGame.placingPoint?.tileIndex !== hoveredTile.value.tileIndex)
  ) {
    hoveredTile.value = updatedGame.placingPoint || {
      rowIndex: undefined,
      tileIndex: undefined,
    }

    zoomToTile(hoveredTile.value)
    clearGameUpdateTimeout()
    gameUpdateTimeout = setTimeout(() => {
      gameUpdateTimeout = undefined
      const targetTile = findTileElement(
        hoveredTile.value.rowIndex ?? -1,
        hoveredTile.value.tileIndex ?? -1
      )
      const targetTileRect = targetTile?.getBoundingClientRect()

      if (targetTileRect) {
        currentStatePosition.value = {
          x: targetTileRect.left,
          y: targetTileRect.top,
        }
      }
    }, 1000)
  }

  if (
    !isMyTurn &&
    (localCurrentTile.value.id !== updatedGame.currentTile?.id ||
      localCurrentTile.value.rotation !== updatedGame.currentTile?.rotation)
  ) {
    syncLocalTile(updatedGame.currentTile)
  }

  if (localCurrentTile.value.id !== updatedGame.currentTile?.id) {
    syncLocalTile(updatedGame.currentTile)

    hoveredTile.value =
      updatedGame.placingPoint?.rowIndex !== undefined &&
      updatedGame.placingPoint?.tileIndex !== undefined
        ? updatedGame.placingPoint
        : hoveredTile.value
  }
}

const handleGameCreated = (gameId: string) => {
  localStorage.setItem('lastGameId', gameId)
}

const rotateLocalTile = (tile: ITile, direction: RotationDirection) => {
  placementConflicts.value = []
  const newTile = rotateTileUtil(tile, direction)
  localCurrentTile.value = newTile
  void GameService.setCurrentTileRotation(newTile.rotation).catch((error) => {
    notifyError(error, 'Не удалось повернуть плитку на сервере')
  })
}

const placeTile = async (
  tile: ITile,
  { rowIndex, tileIndex }: { rowIndex?: number; tileIndex?: number }
) => {
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
  try {
    const gamesList = await GameService.getGamesList()
    updateLocalGamesList(gamesList)
  } catch (error) {
    notifyError(error, 'Произошла ошибка при получении списка игр')
  }
}

const joinGame = async (gameId: string) => {
  try {
    const game = await GameService.joinGame(gameId)
    console.log(game, game.gameIsStarted)
    if (!game.gameIsStarted) {
      currentGame.value = game
      playersList.value = game.players
    } else {
      showLobby.value = false
    }
  } catch (error) {
    notifyError(error)
  }
}

const leaveGame = async () => {
  try {
    await GameService.leaveGame()
    activeGameId = undefined
    updateSelectedPlacingPoint.cancel()
    clearGameUpdateTimeout()
    playersList.value = []
    currentGame.value = null
    getGamesList()
  } catch (error) {
    notifyError(error)
  }
}

const goInLobby = async () => {
  try {
    await GameService.leaveGame()

    activeGameId = undefined
    updateSelectedPlacingPoint.cancel()
    clearGameUpdateTimeout()
    showLobby.value = true
    currentGame.value = null
    playersList.value = []
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

const rejoinGame = async (gameId: string) => {
  try {
    const game = await GameService.rejoinGame(gameId)
    if (!game.gameIsStarted) {
      currentGame.value = game
      playersList.value = game.players
    } else {
      showLobby.value = false
    }
  } catch (error) {
    notifyError(error)
  }
}

const playersReconnectProcess = computed(() => {
  return !gameState.value.gameIsEnded && reconnectingPlayers.value?.length > 0
})

const reconnectingPlayers = computed(() => {
  return gameState.value.players?.filter(
    (player) => !player.socketId && player.deviceId
  )
})

const games = ref<LobbyGame[]>([])
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

onMounted(async () => {
  GameService.connect()

  const unsubscribeGameUpdated = GameService.onGameUpdated(onGameUpdated)
  const socket = GameService.socket
  const onGamesListUpdated = (gamesList: GameSummary[]) => {
    updateLocalGamesList(gamesList)
  }
  const onConnect = () => {
    void getGamesList()
  }

  socket?.on(SocketEvents.UpdateGamesList, onGamesListUpdated)
  socket?.on('connect', onConnect)

  cleanupSocketListeners = () => {
    unsubscribeGameUpdated()
    socket?.off(SocketEvents.UpdateGamesList, onGamesListUpdated)
    socket?.off('connect', onConnect)
  }
})
</script>
