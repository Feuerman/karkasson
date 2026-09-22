<template>
  <div class="relative flex h-full flex-col bg-surface-muted text-text">
    <div
      v-if="playersReconnectProcess"
      class="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-black/80 text-lg font-medium text-white"
    >
      <div class="flex flex-col items-center gap-2.5">
        <div
          class="h-10 w-10 animate-spin rounded-full border-4 border-track border-t-accent"
        ></div>
        <div>Ожидание подключения игроков</div>
      </div>
      <div class="flex flex-wrap justify-center gap-2.5">
        <div
          v-for="player in reconnectingPlayers"
          :key="player.id"
          class="rounded bg-white/20 px-2.5 py-1"
        >
          {{ player.name }}
        </div>
      </div>
    </div>
    <div
      v-if="!showLobby"
      class="group fixed right-8 top-8 z-[9999] flex cursor-pointer items-center justify-center gap-2.5 rounded bg-success px-2.5 py-1 text-base text-white transition-colors duration-200 hover:bg-success/80 active:bg-success/60"
      @click="goInLobby"
    >
      <i class="fa fa-home" aria-hidden="true">&lt;</i>
      <span
        class="block w-0 overflow-hidden whitespace-nowrap transition-[width] duration-200 group-hover:w-[145px]"
        >Выйти из игры</span
      >
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
    <GameControls :game-board="gameState" />
    <GameActionsHistory
      :game-board="gameState"
      @highlight-object="highlightObject"
    />
    <GamePlacingFollowers :game-board="gameState" />
    <Draggable
      v-if="!gameState.isPlacingFollower"
      :initial-x="currentStatePosition.x"
      :initial-y="currentStatePosition.y"
      :disabled="!gameState.isMyTurn"
      draggable-id="tile-preview"
    >
      <div class="overflow-hidden [transform-origin:center]">
        <button
          v-if="gameState.isMyTurn"
          class="absolute -top-[30px] left-1/2 flex -translate-x-1/2 cursor-pointer items-center justify-center rounded bg-success px-2.5 py-1 text-[14px] text-white transition-colors duration-200 hover:bg-success/80 active:bg-success/60"
          @click="
            gameState.isMyTurn && placeTile(localCurrentTile, hoveredTile)
          "
        >
          Разместить
        </button>
        <div
          v-if="gameState.isMyTurn"
          class="absolute left-1/2 top-[15px] z-[9999] flex -translate-x-1/2 gap-[35px] rounded"
        >
          <button
            class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-0 bg-primary text-base text-white transition-colors duration-200 hover:bg-primary-dark active:bg-primary-darker"
            @click.stop.prevent="
              rotateTile(localCurrentTile, 'counterclockwise')
            "
          >
            ↺
          </button>
          <button
            class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-0 bg-primary text-base text-white transition-colors duration-200 hover:bg-primary-dark active:bg-primary-darker"
            @click.stop.prevent="rotateTile(localCurrentTile, 'clockwise')"
          >
            ↻
          </button>
        </div>
        <TileView
          :tile="localCurrentTile"
          class="relative cursor-grab overflow-hidden rounded-lg transition-transform duration-200 active:cursor-grabbing"
        />
      </div>
    </Draggable>
    <div
      ref="gameBoardRef"
      class="flex w-full flex-col gap-2.5 overflow-scroll rounded-lg bg-board p-2.5 shadow-[inset_0_0_10px_rgba(0,0,0,0.1)]"
    >
      <div
        v-for="(row, rowIndex) in defaultGrid"
        :key="rowIndex"
        class="flex gap-2.5"
      >
        <div
          v-for="(tile, tileIndex) in row"
          :key="tileIndex"
          class="relative h-[115px] w-[115px] flex-shrink-0 rounded-lg border border-border bg-surface shadow-soft transition-all duration-200"
          :class="[
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
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import TileView from './components/TileView.vue'
import GameControls from './components/GameControls.vue'
import GameActionsHistory from './components/GameActionsHistory.vue'
import Draggable from './components/Draggable.vue'
import GamePlacingFollowers from './components/GamePlacingFollowers.vue'
import { deepClone, throttle } from './utils/common'
import GameLobby from './components/GameLobby.vue'
import GameService from './modules/GameService'
import notificationService from './plugins/notification'
import type { IGame, IGameBoard, ITile } from './types/game'

const gameState = ref<IGameBoard>({} as IGameBoard)
const gameServiceState = reactive(GameService)

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

const localCurrentTile = ref<ITile>({
  id: '',
  rotation: 0,
  sides: {},
  followers: [],
  imgUrl: '',
  name: '',
  description: '',
})

const showLobby = ref(true)

const gameBoardRef = ref<HTMLElement | null>(null)

const updateSelectedPlacingPoint = throttle(
  async (value: { rowIndex: number; tileIndex: number }) => {
    const res = await GameService.selectPlacingPoint(value)
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
  if (!rowIndex || !tileIndex) {
    return
  }
  const targetTile = document.querySelector(
    '[data-row-index="' + rowIndex + '"][data-tile-index="' + tileIndex + '"]'
  )

  if (targetTile) {
    targetTile?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    })
  }
}

const highlightPoints = ref<number[][]>([])
const highlightObject = (objectData: { points?: number[][] }) => {
  highlightPoints.value = []
  if (objectData.points) {
    highlightPoints.value = objectData.points
  }
}

const onGameStart = (gameData: IGame) => {
  const isMyTurn = gameData.currentPlayer?.socketId === GameService.socket?.id

  showLobby.value = false
  gameState.value = {
    ...gameData,
    isMyTurn,
  } as IGameBoard

  if (
    gameData.placingPoint?.rowIndex !== undefined &&
    gameData.placingPoint?.tileIndex !== undefined
  ) {
    hoveredTile.value = gameData.placingPoint || {
      rowIndex: null,
      tileIndex: null,
    }
  }

  if (gameData.currentTile) {
    localCurrentTile.value = {
      ...gameData.currentTile,
    } as ITile
  }

  handleGameCreated(gameData.id)

  GameService.onGameUpdated((updatedGame: IGame) => {
    const isMyTurn =
      updatedGame.currentPlayer?.socketId === GameService.socket?.id

    gameState.value = {
      ...updatedGame,
      isMyTurn,
    } as IGameBoard

    if (
      !isMyTurn &&
      (updatedGame.placingPoint?.rowIndex !== hoveredTile.value.rowIndex ||
        updatedGame.placingPoint?.tileIndex !== hoveredTile.value.tileIndex)
    ) {
      hoveredTile.value = updatedGame.placingPoint || {
        rowIndex: null,
        tileIndex: null,
      }

      zoomToTile(hoveredTile.value)

      setTimeout(() => {
        const targetTile = document.querySelector(
          '[data-row-index="' +
            hoveredTile.value.rowIndex +
            '"][data-tile-index="' +
            hoveredTile.value.tileIndex +
            '"]'
        )
        const targetTileRect = targetTile?.getBoundingClientRect()

        if (targetTileRect) {
          currentStatePosition.value = {
            x: targetTileRect.left + 10,
            y: targetTileRect.top + 15,
          }
        }
      }, 1000)
    }

    if (
      !isMyTurn &&
      (localCurrentTile.value.id !== updatedGame.currentTile?.id ||
        localCurrentTile.value.rotation !== updatedGame.currentTile?.rotation)
    ) {
      localCurrentTile.value = {
        ...updatedGame.currentTile,
      } as ITile
    }

    if (localCurrentTile.value.id !== updatedGame.currentTile?.id) {
      localCurrentTile.value = {
        ...updatedGame.currentTile,
      } as ITile

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
      ({ deviceId, playerIds }: { deviceId: string; playerIds: any[] }) => {
        // console.log('Player temporarily disconnected:', { deviceId, playerIds });
      }
    )

    GameService.socket.on(
      'playerReconnected',
      ({ deviceId, playerIds }: { deviceId: string; playerIds: any[] }) => {
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

const rotateTile = (
  tile: ITile,
  direction: 'clockwise' | 'counterclockwise'
) => {
  const newTile = deepClone(tile)

  if (direction === 'clockwise') {
    if (newTile.rotation + 90 > 360) {
      newTile.rotation = 0
    }
    newTile.rotation += 90

    newTile.sides = {
      ...newTile.sides,
      north: newTile.sides.west,
      west: newTile.sides.south,
      south: newTile.sides.east,
      east: newTile.sides.north,
    }
  } else {
    if (newTile.rotation - 90 < 0) {
      newTile.rotation = 360
    }
    newTile.rotation -= 90

    newTile.sides = {
      ...newTile.sides,
      north: newTile.sides.east,
      west: newTile.sides.north,
      south: newTile.sides.west,
      east: newTile.sides.south,
    }
  }

  localCurrentTile.value = newTile

  updateCurrentTile(newTile)
}

const placeTile = async (
  tile: ITile,
  { rowIndex, tileIndex }: { rowIndex: number; tileIndex: number }
) => {
  if (typeof rowIndex !== 'number' || typeof tileIndex !== 'number') {
    notificationService.error('Выберите клетку для размещения')
    return
  }

  try {
    await GameService.placeTile(tile, { rowIndex, tileIndex })
  } catch (e: unknown) {
    if (e instanceof Error) {
      notificationService.error(e.message)
    } else {
      notificationService.error('Произошла ошибка при размещении плитки')
    }
  }
}

const updateLocalGamesList = (gamesList: IGame[]) => {
  const savedGameId = localStorage.getItem('lastGameId')

  games.value = gamesList.map((game) => ({
    ...game,
    isLastGame: game.id === savedGameId,
  }))
}

const getGamesList = async () => {
  try {
    const gamesList = (await GameService.getGamesList()) as IGame[]
    updateLocalGamesList(gamesList)
  } catch (error) {
    if (error instanceof Error) {
      notificationService.error(error.message)
    } else {
      notificationService.error('Произошла ошибка при получении списка игр')
    }
  }
}

const joinGame = async (gameId: string) => {
  try {
    const game = (await GameService.joinGame(gameId)) as IGame
    console.log(game, game.gameIsStarted)
    if (!game.gameIsStarted) {
      currentGame.value = game
      playersList.value = game.players
    } else {
      showLobby.value = false
    }
  } catch (error) {
    notificationService.error(error || error.message)
  }
}

const leaveGame = async () => {
  try {
    await GameService.leaveGame()
    playersList.value = []
    currentGame.value = null
    getGamesList()
  } catch (error) {
    notificationService.error(error || error.message)
  }
}

const goInLobby = async () => {
  try {
    await GameService.leaveGame()

    showLobby.value = true
    currentGame.value = null
    playersList.value = []
    gameState.value = {}
    getGamesList()
  } catch (error) {
    notificationService.error(error || error.message)
  }
}

const createGame = async () => {
  try {
    const game = (await GameService.createGame()) as IGame
    currentGame.value = game
    playersList.value = game.players
  } catch (error) {
    notificationService.error(error || error.message)
  }
}

const rejoinGame = async (gameId: string) => {
  try {
    const game = (await GameService.rejoinGame(gameId)) as IGame
    if (!game.gameIsStarted) {
      currentGame.value = game
      playersList.value = game.players
    } else {
      showLobby.value = false
    }
  } catch (error) {
    notificationService.error(error || error.message)
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

const games = ref<IGame[]>([])
const playersList = ref<any[]>([])
const currentGame = ref<IGame | null>(null)

onMounted(async () => {
  GameService.connect()

  GameService.onGameUpdated((game: IGame) => {
    playersList.value = game.players
    if (game.gameIsStarted && !gameState.value.gameIsStarted) {
      onGameStart(game)
    }
  })

  if (GameService.socket) {
    GameService.socket.on('updateGamesList', (gamesList: IGame[]) => {
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
