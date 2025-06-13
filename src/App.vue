<template>
  <div class="game-wrapper">
    <div v-if="playersReconnectProcess" class="players-reconnect">
      <div class="players-reconnect__title">
        <div class="loader-spinner"></div>
        <div>Ожидание подключения игроков</div>
      </div>
      <div class="players-reconnect__players">
        <div
          v-for="player in reconnectingPlayers"
          :key="player.id"
          class="players-reconnect__player"
        >
          {{ player.name }}
        </div>
      </div>
    </div>
    <div v-if="!showLobby" class="back-to-lobby" @click="goInLobby">
      <i class="fa fa-home" aria-hidden="true">&lt;</i>
      <span>Выйти из игры</span>
    </div>
    <GameLobby
      v-if="showLobby"
      :game="gameState"
      :games-list="games"
      :players="playersList"
      :current-game="currentGame"
      @startGame="showLobby = false"
      @gameStarted="onGameStart"
      @rejoinGame="rejoinGame"
      @joinGame="joinGame"
      @leaveGame="leaveGame"
      @createGame="createGame"
      @updateGamesList="getGamesList"
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
      <div class="game-preview-tile">
        <button
          v-if="gameState.isMyTurn"
          class="game-preview-tile__place-button"
          @click="
            gameState.isMyTurn && placeTile(localCurrentTile, hoveredTile)
          "
        >
          Разместить
        </button>
        <div v-if="gameState.isMyTurn" class="game-preview-tile__controls">
          <button
            @click.stop.prevent="
              rotateTile(localCurrentTile, 'counterclockwise')
            "
          >
            ↺
          </button>
          <button
            @click.stop.prevent="rotateTile(localCurrentTile, 'clockwise')"
          >
            ↻
          </button>
        </div>
        <TileView :tile="localCurrentTile" class="preview-tile" />
      </div>
    </Draggable>
    <div class="game-board" ref="gameBoardRef">
      <div
        v-for="(row, rowIndex) in defaultGrid"
        :key="rowIndex"
        class="game-row"
      >
        <div
          v-for="(tile, tileIndex) in row"
          :key="tileIndex"
          class="game-tile"
          :class="[
            hoveredTile?.rowIndex === rowIndex &&
            hoveredTile?.tileIndex === tileIndex
              ? '--active'
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
    '.game-tile[data-row-index="' +
      rowIndex +
      '"][data-tile-index="' +
      tileIndex +
      '"]'
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
          '.game-tile[data-row-index="' +
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
    if (!game.gameIsStarted) {
      currentGame.value = game
      playersList.value = game.players
    } else {
      showLobby.value = false
    }
  } catch (error) {
    if (error instanceof Error) {
      notificationService.error(error.message)
    } else {
      notificationService.error('Произошла ошибка при присоединении к игре')
    }
  }
}

const leaveGame = async () => {
  try {
    await GameService.leaveGame()
    playersList.value = []
    currentGame.value = null
    getGamesList()
  } catch (error) {
    if (error instanceof Error) {
      notificationService.error(error.message)
    } else {
      notificationService.error('Произошла ошибка при выходе из игры')
    }
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
    if (error instanceof Error) {
      notificationService.error(error.message)
    } else {
      notificationService.error('Действие не удалось, повторите попытку')
    }
  }
}

const createGame = async () => {
  try {
    const game = (await GameService.createGame()) as IGame
    currentGame.value = game
    playersList.value = game.players
  } catch (error) {
    if (error instanceof Error) {
      notificationService.error(error.message)
    } else {
      notificationService.error('Произошла ошибка при создании игры')
    }
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
    if (error instanceof Error) {
      notificationService.error(error.message)
    } else {
      notificationService.error('Произошла ошибка при переподключении к игре')
    }
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

<style lang="scss" scoped>
.game-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  background-color: #f5f5f5;
  color: #333;
}

.game-header {
  padding: 1rem;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;

  &__left,
  &__right {
    display: flex;
    gap: 1rem;
  }
}

.game-board {
  width: 100%;
  display: flex;
  gap: 10px;
  flex-direction: column;
  background-color: #e8e8e8;
  overflow: scroll;
  padding: 10px;
  border-radius: 8px;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.1);

  .game-row {
    display: flex;
    gap: 10px;
  }

  .game-tile {
    position: relative;
    flex-shrink: 0;
    width: 115px;
    height: 115px;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
    transition: all 0.2s ease;
    background-color: #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

    &.drop-possible {
      box-shadow: 0 0 15px rgba(76, 175, 80, 0.7);
      background-color: rgba(76, 175, 80, 0.1);
    }

    &.drop-forbidden {
      box-shadow: 0 0 15px rgba(244, 67, 54, 0.7);
      background-color: rgba(244, 67, 54, 0.1);
    }

    &.--active {
      box-shadow: 0 0 8px 8px rgba(76, 175, 80, 0.7);
      border: 1px solid rgba(76, 175, 80, 0.7);
      background-color: rgba(76, 175, 80, 0.7);
    }
  }

  .game-tile__coords {
    position: absolute;
    top: -22px;
    left: 5px;
    font-size: 0.8rem;
    color: #666;
    background-color: rgba(255, 255, 255, 0.8);
    padding: 2px 4px;
    border-radius: 4px;
  }
}

.preview-tile {
  position: relative;
  cursor: grab;
  transition: transform 0.2s ease;
  border-radius: 8px;
  overflow: hidden;

  &:active {
    cursor: grabbing;
  }
}

.dragged-tile {
  position: fixed;
  top: 0;
  left: 0;
  width: 110px;
  height: 110px;
  filter: drop-shadow(0 0 10px rgba(0, 0, 0, 0.3));
  transform-origin: center;
  border-radius: 8px;
  overflow: hidden;

  &:hover {
    transform: scale(1.05);
  }
}

.game-preview-tile {
  transform-origin: center;
  overflow: hidden;

  &__place-button {
    position: absolute;
    top: -30px;
    left: 50%;
    transform: translateX(-50%);
    border: none;
    background-color: rgba(76, 175, 80, 1);
    padding: 5px 10px;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: rgba(76, 175, 80, 0.8);
    }

    &:active {
      background-color: rgba(76, 175, 80, 0.6);
    }
  }

  &__controls {
    z-index: 9999;
    display: flex;
    gap: 35px;
    position: absolute;
    top: 15px;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 4px;

    button {
      width: 24px;
      height: 24px;
      border: none;
      background-color: #2196f3;
      color: white;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      transition: background-color 0.2s ease;

      &:hover {
        background-color: #1976d2;
      }

      &:active {
        background-color: #1565c0;
      }
    }
  }
}

.back-to-lobby {
  position: fixed;
  top: 30px;
  right: 30px;
  z-index: 9999;
  border: none;
  background-color: rgba(76, 175, 80, 1);
  padding: 5px 10px;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 16px;
  transition: background-color 0.2s ease;

  span {
    display: block;
    width: 0;
    overflow: hidden;
    white-space: nowrap;
    transition: width 0.2s ease;
  }

  &:hover {
    background-color: rgba(76, 175, 80, 0.8);
    span {
      width: 145px;
    }
  }

  &:active {
    background-color: rgba(76, 175, 80, 0.6);
  }
}

.players-reconnect {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  color: white;
  font-size: 1.2rem;
  font-weight: 500;

  &__title {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  &__players {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  &__player {
    padding: 5px 10px;
    border-radius: 4px;
    background-color: rgba(255, 255, 255, 0.2);
  }
}

.loader-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #5a80aa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
