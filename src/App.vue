<template>
  <div class="game-wrapper">
    <div v-if="!showLobby" class="back-to-lobby" @click="goInLobby">
      <i class="fa fa-home" aria-hidden="true"><</i>
      <span>Вернуться в лобби</span>
    </div>
    <GameLobby v-if="showLobby" :game="gameState" :games-list="games" :players="playersList" :current-game="currentGame" @gameStarted="onGameStart" @rejoinGame="rejoinGame" @joinGame="joinGame" @leaveGame="leaveGame" @createGame="createGame" @updateGamesList="getGamesList"/>
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
        v-for="(row, rowIndex) in currentGrid"
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
            :tile="tile"
            :followers="gameState.placedFollowers"
            :highlight-points="highlightPoints"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {computed, nextTick, onMounted, ref, watch} from 'vue'
import TileView from './components/TileView.vue'
import GameControls from '@/components/GameControls.vue'
import GameActionsHistory from '@/components/GameActionsHistory.vue'
import Draggable from '@/components/Draggable.vue'
import GamePlacingFollowers from '@/components/GamePlacingFollowers.vue'
import { deepClone, throttle } from '@/utils/common'
import GameLobby from '@/components/GameLobby.vue'
import GameService from '@/modules/GameService'
import notificationService from '@/plugins/notification'

const gameState = ref({})

const defaultGrid = ref([
  ...Array(50)
    .fill(null)
    .map(() => Array(50).fill(null)),
])
const currentGrid = computed(() => defaultGrid.value)

watch(
  () => gameState.value.tilePlacesStats,
  () => {
    nextTick(() => {
      Object.keys(gameState.value.tilePlacesStats || {}).forEach((rowIndex) => {
        Object.keys(gameState.value.tilePlacesStats[rowIndex]).forEach(
          (tileIndex) => {
            defaultGrid.value[rowIndex][tileIndex] = gameState.value.tilePlacesStats[rowIndex][tileIndex]
          }
        )
      })
    })
  },
  { deep: true, immediate: true }
)

const currentStatePosition = ref({
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
})

const hoveredTile = ref({
  rowIndex: null,
  tileIndex: null,
})

const localCurrentTile = ref({
  id: null,
  rotation: 0,
  sides: {},
  followers: [],
  imgUrl: '',
  name: '',
  description: '',
})

const showLobby = ref(true)

const gameBoardRef = ref(null)

const updateSelectedPlacingPoint = throttle(async (value) => {
  const res = await GameService.selectPlacingPoint(value)
}, 300)

const updateCurrentTile = throttle(async (tile) => {
  await GameService.updateCurrentTile(tile)
}, 300)

const handleTileClick = (rowIndex, tileIndex) => {
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

const zoomToTile = ({ rowIndex, tileIndex } = {}) => {
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

const highlightPoints = ref([])
const highlightObject = (objectData) => {
  highlightPoints.value = []
  if (objectData.points) {
    highlightPoints.value = objectData.points
  }
}

const onGameStart = (gameData) => {
  const isMyTurn = gameData.currentPlayer?.socketId === GameService.socket?.id

  showLobby.value = false
  gameState.value = {
    ...gameData,
    isMyTurn,
  }

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
    }
  }

  handleGameCreated(gameData.id)

  GameService.onGameUpdated((updatedGame) => {
    const isMyTurn =
      updatedGame.currentPlayer?.socketId === GameService.socket?.id

    gameState.value = {
      ...updatedGame,
      isMyTurn,
    }

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

        currentStatePosition.value = {
          x: targetTileRect.left + 10,
          y: targetTileRect.top + 15,
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
      }
    }

    if (localCurrentTile.value.id !== updatedGame.currentTile?.id) {
      localCurrentTile.value = {
        ...updatedGame.currentTile,
      }

      hoveredTile.value =
        updatedGame.placingPoint?.rowIndex !== undefined &&
        updatedGame.placingPoint?.tileIndex !== undefined
          ? updatedGame.placingPoint
          : hoveredTile.value
    }
  })

  GameService.socket.on(
    'playerTemporaryDisconnected',
    ({ deviceId, playerIds }) => {
      // console.log('Player temporarily disconnected:', { deviceId, playerIds });
      // playerIds.forEach(player => {
      //   if (player) {
      //     player.isDisconnected = true;
      //     alert(`Игрок ${player.name} временно отключился. Ожидаем переподключения...`);
      //   }
      // });
    }
  )

  GameService.socket.on('playerReconnected', ({ deviceId, playerIds }) => {
    console.log('Player reconnected:', { deviceId, playerIds })
    // playerIds.forEach(player => {
    //   if (player) {
    //     player.isDisconnected = false;
    //     alert(`Игрок ${player.name} переподключился к игре`);
    //   }
    // });
  })

  GameService.socket.on('playerDisconnected', () => {
    showLobby.value = true
  })
}

const handleGameCreated = (gameId: string) => {
  localStorage.setItem('lastGameId', gameId)
}

const rotateTile = (tile, direction) => {
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

const placeTile = async (tile, { rowIndex, tileIndex }) => {
  if (typeof rowIndex !== 'number' || typeof tileIndex !== 'number') {
    notificationService.error('Выберите клетку для размещения')
    return
  }

  try {
    await GameService.placeTile(tile, { rowIndex, tileIndex })
  } catch (e: unknown) {
    notificationService.error(e)
  }
}

const updateLocalGamesList = (gamesList) => {

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
    notificationService.error(error)
  }
}

const joinGame = async (gameId) => {
  try {
    const game = await GameService.joinGame(gameId)
    if (!game.gameIsStarted) {
      currentGame.value = game
      playersList.value = game.players
    } else {
      showLobby.value = false
    }
  } catch (error) {
    notificationService.error(error)
  }
}

const leaveGame = async () => {
  try {
    await GameService.leaveGame()

    playersList.value = []
    currentGame.value = null

    getGamesList()
  } catch (error) {
    notificationService.error(error)
  }
}

const goInLobby = () => {
  showLobby.value = true
  currentGame.value = null
  playersList.value = []

  getGamesList()
}

const createGame = async () => {
  try {
    if (gameState.value.gameIsStarted) {
      await GameService.leaveGame()
    }
    const game = await GameService.createGame()
    currentGame.value = game
    playersList.value = game.players
  } catch (error) {
    notificationService.error(error)
  }
}

const rejoinGame = async (gameId) => {
  try {
    const game = await GameService.rejoinGame(gameId)
    if (!game.gameIsStarted) {
      currentGame.value = game
      playersList.value = game.players
    } else {
      showLobby.value = false
    }
  } catch (error) {
    notificationService.error(error)
  }
}

const games = ref([])
const playersList = ref([])
const currentGame = ref(null)

onMounted(async () => {
  GameService.connect()

  GameService.onGameUpdated((game) => {
    playersList.value = game.players
    if (game.gameIsStarted && !gameState.value.gameIsStarted) {
      onGameStart(game)
    }
  })

  GameService.socket.on('updateGamesList', (gamesList) => {
    updateLocalGamesList(gamesList)
  })

  GameService.socket.on('connect', () => {
    getGamesList()
  })

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
</style>
