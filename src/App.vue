<template>
  <UApp class="h-full" :toaster="{ ui: { viewport: 'sm:w-[30rem]' } }">
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
        :pending-actions="pendingList"
        :device-id="GameService.deviceId"
        @start-game="startGame"
        @rejoin-game="rejoinGame"
        @join-game="joinGame"
        @leave-game="leaveGame"
        @create-game="createGame"
        @add-player="addPlayer"
        @remove-player="removePlayer"
      />
      <GameBoard
        :game-board="gameState"
        :layout-edit-mode="isLayoutEditMode"
        :show-lobby="showLobby"
      />
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
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import GameBoard from './components/GameBoard.vue'
import type { GameMenuItem } from './components/GameMenu.vue'
import BottomToolbar from './components/BottomToolbar.vue'
import ReconnectingOverlay from './components/ReconnectingOverlay.vue'
import UApp from '@nuxt/ui/components/App.vue'
import ToastBridge from './components/ToastBridge.vue'
import { notifyError } from './utils/common'
import notificationService from './plugins/notification'
import GameLobby from './components/GameLobby'
import GameService from './modules/GameService'
import type { CreateGameOptions } from './modules/GameService'
import {
  pendingActionKeys,
  usePendingActions,
} from './composables/usePendingActions'
import type { IGame, IGameBoard, LobbyGame } from './types/game'
import type { GameSummary } from '@server/services/GameService'
import { SocketEvents, type Player } from '@server/modules/types'
import type { RulesDocument } from './rules/types'

const RulesPanel = defineAsyncComponent(
  () => import('./components/rules/RulesPanel.vue')
)

const gameState = ref<IGameBoard>({} as IGameBoard)

/**
 * Состояние хода до последнего обновления.
 *
 * `null` означает, что состояние партии ещё не приходило: первый снимок
 * уведомления не вызывает, иначе игрок получал бы «Ваш ход» при входе в
 * партию, а не при настоящей передаче хода.
 */
const previousIsMyTurn = ref<boolean | null>(null)

watch(
  () => gameState.value.isMyTurn,
  (isMyTurn) => {
    const previous = previousIsMyTurn.value
    previousIsMyTurn.value = isMyTurn
    if (previous === null) return
    if (isMyTurn && !previous) {
      notificationService.info('Ваш ход')
    }
  }
)

const showLobby = ref(true)
const isLayoutEditMode = ref(false)

/** Команды, ожидающие ответа сервера: индикаторы занятости в интерфейсе. */
const { pendingList, runPending } = usePendingActions()

/** Добавляет к серверному снимку локальный признак текущего хода. */
const applyGameState = (game: IGame) => {
  const isMyTurn = game.currentPlayer?.socketId === GameService.socket?.id
  gameState.value = { ...game, isMyTurn } as IGameBoard
}

let activeGameId: string | undefined
let cleanupSocketListeners: (() => void) | undefined

const onGameStart = (gameData: IGame) => {
  activeGameId = gameData.id
  applyGameState(gameData)

  showLobby.value = false

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

  applyGameState(updatedGame)
}

const handleGameCreated = (gameId: string) => {
  localStorage.setItem('lastGameId', gameId)
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
  await runPending(pendingActionKeys.joinGame(gameId), async () => {
    try {
      enterGame(await GameService.joinGame(gameId))
    } catch (error) {
      notifyError(error)
    }
  })
}

const rejoinGame = async (gameId: string) => {
  await runPending(pendingActionKeys.rejoinGame(gameId), async () => {
    try {
      enterGame(await GameService.rejoinGame(gameId))
    } catch (error) {
      notifyError(error)
    }
  })
}

/** Сбрасывает локальное состояние партии перед возвратом в лобби. */
const clearSession = () => {
  activeGameId = undefined
  playersList.value = []
  currentGame.value = null
  previousIsMyTurn.value = null
}

const leaveGame = async () => {
  await runPending(pendingActionKeys.leaveGame(), async () => {
    try {
      await GameService.leaveGame()
      clearSession()
      getGamesList()
    } catch (error) {
      notifyError(error)
    }
  })
}

const goInLobby = async () => {
  await runPending(pendingActionKeys.leaveGame(), async () => {
    try {
      await GameService.leaveGame()
      clearSession()
      showLobby.value = true
      gameState.value = {} as IGameBoard
      getGamesList()
    } catch (error) {
      notifyError(error)
    }
  })
}

const createGame = async (options: CreateGameOptions) => {
  await runPending(pendingActionKeys.createGame(), async () => {
    try {
      const game = await GameService.createGame(options)
      currentGame.value = game
      playersList.value = game.players
    } catch (error) {
      notifyError(error)
    }
  })
}

const addPlayer = async (name: string, index: number) => {
  await runPending(pendingActionKeys.slot(index), async () => {
    try {
      await GameService.addPlayer({ name, index })
    } catch (error) {
      notifyError(error)
    }
  })
}

const removePlayer = async (index: number, keepAsComputer: boolean) => {
  await runPending(pendingActionKeys.slot(index), async () => {
    try {
      await GameService.removePlayer(index, keepAsComputer)
    } catch (error) {
      notifyError(error)
    }
  })
}

const startGame = async () => {
  await runPending(pendingActionKeys.startGame(), async () => {
    try {
      onGameStart(await GameService.startGame())
    } catch (error) {
      notifyError(error)
    }
  })
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
})

onMounted(() => {
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
