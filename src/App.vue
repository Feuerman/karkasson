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
      <UButton
        v-if="!showLobby"
        color="success"
        icon="i-lucide-arrow-left"
        class="group fixed right-8 top-8 z-[9999] flex cursor-pointer items-center justify-center gap-2.5 px-2.5 py-1 text-base text-white"
        @click="goInLobby"
      >
        <span
          class="block w-0 overflow-hidden whitespace-nowrap transition-[width] duration-200 group-hover:w-[145px]"
          >Выйти из игры</span
        >
      </UButton>
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
      <GameControls :game-board="gameState" />
      <GameActionsHistory
        :game-board="gameState"
        @highlight-object="highlightObject"
      />
      <GamePlacingFollowers :game-board="gameState" />
      <Draggable
        v-if="!gameState.isPlacingFollower"
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
            class="absolute -top-[30px] left-1/2 z-10 -translate-x-1/2 cursor-pointer px-2.5 py-1 text-[14px] text-white"
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
              class="flex h-6 w-6 cursor-pointer items-center justify-center !p-0 text-white"
              :ui="{ leadingIcon: 'size-4' }"
              @mousedown.stop
              @click.stop.prevent="
                rotateLocalTile(localCurrentTile, 'counterclockwise')
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
              class="flex h-6 w-6 cursor-pointer items-center justify-center !p-0 text-white"
              :ui="{ leadingIcon: 'size-4' }"
              @mousedown.stop
              @click.stop.prevent="
                rotateLocalTile(localCurrentTile, 'clockwise')
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
            class="grid origin-top-left grid-cols-[repeat(50,115px)] gap-2.5 p-2.5"
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
                ]"
                :data-row-index="rowIndex"
                :data-tile-index="tileIndex"
                @click="handleTileClick(rowIndex, tileIndex)"
              >
                <TileView
                  :tile="gameState.tilePlacesStats?.[rowIndex]?.[tileIndex]"
                  :followers="gameState.placedFollowers"
                  :highlight-points="highlightPoints"
                  :size="115"
                />
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
        class="fixed bottom-4 right-4 z-[3000] flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-white shadow-strong"
        @click="resetZoom"
      >
        100%
      </UButton>
      <GameMenu :items="menuItems" @select="onMenuSelect" />
      <RulesPanel v-model:open="showRules" :doc="baseGameRules" />
    </div>
  </UApp>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import TileView from './components/TileView.vue'
import GameControls from './components/GameControls.vue'
import GameActionsHistory from './components/GameActionsHistory.vue'
import Draggable from './components/Draggable.vue'
import GamePlacingFollowers from './components/GamePlacingFollowers.vue'
import GameMenu, { type GameMenuItem } from './components/GameMenu.vue'
import RulesPanel from './components/rules/RulesPanel.vue'
import UApp from '@nuxt/ui/components/App.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UToaster from '@nuxt/ui/components/Toaster.vue'
import ToastBridge from './components/ToastBridge.vue'
import { baseGameRules } from './rules/baseGame'
import { notifyError, throttle } from './utils/common'
import { rotateTile as rotateTileUtil, TILE_SIZE } from './utils/tiles'
import { findTileElement, scrollToTile } from './utils/board'
import GameLobby from './components/GameLobby.vue'
import GameService from './modules/GameService'
import notificationService from './plugins/notification'
import { useBoardPan } from './composables/useBoardPan'
import type { IGame, IGameBoard, ITile, LobbyGame } from './types/game'
import type { GameSummary } from '@server/services/GameService'
import type { Player } from '@server/modules/types'

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

const defaultGrid = ref([
  ...Array(50)
    .fill(null)
    .map(() => Array(50).fill(null)),
])

const currentStatePosition = ref({
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
})

const hoveredTile = ref({
  rowIndex: undefined as number | undefined,
  tileIndex: undefined as number | undefined,
})

const EMPTY_TILE: ITile = {
  id: '',
  rotation: 0,
  sides: {
    north: '' as ITile['sides']['north'],
    west: '' as ITile['sides']['west'],
    south: '' as ITile['sides']['south'],
    east: '' as ITile['sides']['east'],
  },
  followers: [],
  imgUrl: '',
  name: '',
  description: '',
}

const localCurrentTile = ref<ITile>({ ...EMPTY_TILE })

const showLobby = ref(true)

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

const updateCurrentTile = throttle(async (tile: ITile) => {
  await GameService.updateCurrentTile(tile)
}, 300)

const handleTileClick = (rowIndex: number, tileIndex: number) => {
  if (gameState.value.isMyTurn) {
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

const highlightPoints = ref<number[][]>([])
const highlightObject = (objectData: { points?: number[][] }) => {
  highlightPoints.value = []
  if (objectData.points) {
    highlightPoints.value = objectData.points
  }
}

const applyGameState = (game: IGame): boolean => {
  const isMyTurn = game.currentPlayer?.socketId === GameService.socket?.id
  gameState.value = { ...game, isMyTurn } as IGameBoard
  return isMyTurn
}

const syncLocalTile = (tile?: ITile | null) => {
  if (!tile) return
  localCurrentTile.value = { ...tile } as ITile
}

const onGameStart = (gameData: IGame) => {
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

  GameService.onGameUpdated((updatedGame: IGame) => {
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

      setTimeout(() => {
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
  })

  if (GameService.socket) {
    GameService.socket.on(
      'playerTemporaryDisconnected',
      ({
        deviceId: _deviceId,
        playerIds: _playerIds,
      }: {
        deviceId: string
        playerIds: (string | number)[]
      }) => {
        // console.log('Player temporarily disconnected:', { deviceId, playerIds });
      }
    )

    GameService.socket.on(
      'playerReconnected',
      ({
        deviceId,
        playerIds,
      }: {
        deviceId: string
        playerIds: (string | number)[]
      }) => {
        console.log('Player reconnected:', { deviceId, playerIds })
      }
    )

    GameService.socket.on('playerDisconnected', () => {
      showLobby.value = true
    })
  }
}

const handleGameCreated = (gameId: string) => {
  localStorage.setItem('lastGameId', gameId)
}

const rotateLocalTile = (
  tile: ITile,
  direction: 'clockwise' | 'counterclockwise'
) => {
  const newTile = rotateTileUtil(tile, direction)
  localCurrentTile.value = newTile
  updateCurrentTile(newTile)
}

const placeTile = async (
  tile: ITile,
  { rowIndex, tileIndex }: { rowIndex?: number; tileIndex?: number }
) => {
  if (typeof rowIndex !== 'number' || typeof tileIndex !== 'number') {
    notificationService.error('Выберите клетку для размещения')
    return
  }

  try {
    await GameService.placeTile(tile, { rowIndex, tileIndex })
  } catch (e: unknown) {
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

    showLobby.value = true
    currentGame.value = null
    playersList.value = []
    gameState.value = {} as IGameBoard
    getGamesList()
  } catch (error) {
    notifyError(error)
  }
}

const createGame = async () => {
  try {
    const game = await GameService.createGame()
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
  return reconnectingPlayers.value?.length > 0
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
const menuItems: GameMenuItem[] = [
  { id: 'rules', label: 'Правила игры', icon: 'i-lucide-circle-help' },
]

const onMenuSelect = (id: string) => {
  if (id === 'rules') {
    showRules.value = true
  }
}

onMounted(async () => {
  GameService.connect()

  GameService.onGameUpdated((game: IGame) => {
    playersList.value = game.players
    if (game.gameIsStarted && !gameState.value.gameIsStarted) {
      onGameStart(game)
    }
  })

  if (GameService.socket) {
    GameService.socket.on('updateGamesList', (gamesList: GameSummary[]) => {
      updateLocalGamesList(gamesList)
    })

    GameService.socket.on('connect', () => {
      getGamesList()
    })
  }

  GameService.onPlayerDisconnected(() => {
    console.log('Player disconnected, resetting lobby state')
  })
})
</script>
