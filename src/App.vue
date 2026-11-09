<template>
  <UApp class="h-full" :toaster="{ ui: { viewport: 'sm:w-[30rem]' } }">
    <ToastBridge />
    <ErrorScreen
      v-if="criticalError"
      :message="criticalError.message"
      @reload="reloadApp"
    />
    <div
      v-else
      class="relative flex h-full flex-col bg-surface-muted text-text"
    >
      <ConnectionStatus
        :view="connectionView"
        @retry="GameService.reconnectNow()"
      />
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
        :games-list-error="gamesListError"
        :room-code-error="roomCodeError"
        :create-game-error="createGameError"
        :pending-actions="pendingList"
        :show-room="showRoom"
        :session-id="GameService.sessionId.value ?? ''"
        @start-game="startGame"
        @rejoin-game="rejoinGame"
        @join-game="joinGame"
        @spectate-game="spectateGame"
        @leave-game="leaveGame"
        @back-to-list="backToList"
        @create-game="createGame"
        @add-player="addPlayer"
        @remove-player="removePlayer"
        @retry-games-list="retryGamesList"
      />
      <GameTurnTracker
        v-if="gameState.gameIsStarted && !showLobby"
        :game-board="gameState"
        :sound-enabled="soundEnabled"
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
        :sound-enabled="soundEnabled"
        @select="onMenuSelect"
        @toggle-layout-edit="isLayoutEditMode = !isLayoutEditMode"
        @reset-layout="onResetLayout"
        @toggle-sound="toggleSound"
        @exit="goInLobby"
      />
      <GameResultPanel
        v-if="showResultPanel && gameState.gameIsEnded"
        :game-board="gameState"
        @go-lobby="goInLobby"
        @play-again="playAgain"
        @close="showResultPanel = false"
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
import GameBoard from './components/GameBoard'
import GameTurnTracker from './components/GameTurnTracker.vue'
import type { GameMenuItem } from './components/GameMenu.vue'
import BottomToolbar from './components/BottomToolbar.vue'
import ReconnectingOverlay from './components/ReconnectingOverlay.vue'
import ConnectionStatus from './components/ConnectionStatus.vue'
import UApp from '@nuxt/ui/components/App.vue'
import ToastBridge from './components/ToastBridge.vue'
import { notifyError, errorMessage } from './utils/common'
import notificationService from './plugins/notification'
import GameService, { SocketAckError } from './modules/GameService'
import type { CreateGameOptions } from './modules/GameService'
import { describeConnectionStatus } from './modules/connectionStatus'
import { resetPanelLayout } from './modules/panelLayout'
import {
  pendingActionKeys,
  usePendingActions,
} from './composables/usePendingActions'
import { t, getLocale, setLocale } from './utils/i18n'
import { criticalError } from './modules/criticalError'
import ErrorScreen from './components/ErrorScreen.vue'
import type { IGame, IGameBoard, LobbyGame } from './types/game'
import type { GameSummary } from '@server/services/GameService'
import { SocketEvents, type PlayerView } from '@server/modules/types'
import type { GameDeletedPayload } from './types/socket'
import type { RulesDocument } from './rules/types'

const RulesPanel = defineAsyncComponent(
  () => import('./components/rules/RulesPanel.vue')
)

const GameLobby = defineAsyncComponent(() => import('./components/GameLobby'))

const GameResultPanel = defineAsyncComponent(
  () => import('./components/GameResultPanel.vue')
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
      notificationService.info(t('ui_your_turn'))
    }
  }
)

const showLobby = ref(true)
const isLayoutEditMode = ref(false)
const soundEnabled = ref(localStorage.getItem('soundEnabled') !== 'false')

const toggleSound = () => {
  soundEnabled.value = !soundEnabled.value
  localStorage.setItem('soundEnabled', String(soundEnabled.value))
}

/**
 * Показывать комнату, а не список партий.
 *
 * Игрок может остаться в комнате и вернуться к списку: слот при этом
 * остаётся за ним, в отличие от выхода из комнаты.
 */
const showRoom = ref(false)

/** Текущий игрок наблюдает за партией, неoccupying слот и не участвуя в подсчёте. */
const isSpectator = ref(false)

/**
 * Панель итогов партии.
 *
 * Показывается один раз в конце партии; её можно закрыть, чтобы посмотреть
 * на доску, и вернуть кнопкой в нижней панели.
 */
const showResultPanel = ref(false)

watch(
  () => gameState.value.gameIsEnded,
  (isEnded) => {
    if (isEnded) showResultPanel.value = true
  }
)

/** Команды, ожидающие ответа сервера: индикаторы занятости в интерфейсе. */
const { pendingList, runPending } = usePendingActions()

/** Добавляет к серверному снимку локальный признак текущего хода. */
const applyGameState = (game: IGame) => {
  const isMyTurn =
    Boolean(GameService.sessionId.value) &&
    game.currentPlayer?.sessionId === GameService.sessionId.value
  const previousHistory = gameState.value.actionsHistory ?? []
  const mergedHistory = game.actionsHistoryDelta
    ? [...previousHistory, ...game.actionsHistoryDelta]
    : (game.actionsHistory ?? previousHistory)
  gameState.value = {
    ...game,
    isMyTurn,
    actionsHistory: mergedHistory,
  } as IGameBoard
}

let activeGameId: string | undefined
let cleanupSocketListeners: (() => void) | undefined

const onGameStart = (gameData: IGame) => {
  activeGameId = gameData.id
  applyGameState(gameData)

  showLobby.value = false
  showResultPanel.value = false
  showRoom.value = false

  if (gameData.id) {
    handleGameCreated(gameData.id)
  }
}

const onGameUpdated = (updatedGame: IGame) => {
  if (!updatedGame.gameIsStarted) {
    playersList.value = updatedGame.players
    if (currentGame.value?.id === updatedGame.id) {
      currentGame.value = updatedGame
    }
    return
  }

  if (!gameState.value.gameIsStarted || activeGameId !== updatedGame.id) {
    onGameStart(updatedGame)
    return
  }

  applyGameState(updatedGame)
}

const LAST_GAME_STORAGE_KEY = 'lastGameId'

const forgetLastGame = () => {
  localStorage.removeItem(LAST_GAME_STORAGE_KEY)
}

const handleGameCreated = (gameId: string) => {
  localStorage.setItem(LAST_GAME_STORAGE_KEY, gameId)
}

const updateLocalGamesList = (gamesList: GameSummary[]) => {
  const savedGameId = localStorage.getItem(LAST_GAME_STORAGE_KEY)

  games.value = gamesList.map((game) => ({
    ...game,
    isLastGame: game.id === savedGameId,
  }))
}

const getGamesList = async () => {
  isGamesListLoading.value = true
  gamesListError.value = null
  try {
    const { games: gamesList } = await GameService.getGamesList()
    updateLocalGamesList(gamesList)
  } catch (error) {
    gamesListError.value = errorMessage(error, t('ui_error_games_list'))
    notifyError(error, t('ui_error_games_list'))
  } finally {
    isGamesListLoading.value = false
  }
}

/**
 * Общая часть входа и переподключения: начатая партия открывает доску,
 * иначе остаёмся в лобби комнаты.
 */
const enterGame = (game: IGame) => {
  showRoom.value = true
  if (game.gameIsStarted) {
    showLobby.value = false
    return
  }
  currentGame.value = game
  playersList.value = game.players
}

/**
 * Возврат к списку партий без выхода из комнаты.
 *
 * Слот остаётся за игроком, поэтому в комнату можно вернуться из списка.
 */
const backToList = () => {
  showRoom.value = false
  getGamesList()
}

const retryGamesList = () => {
  gamesListError.value = null
  void getGamesList()
}

const joinGame = async (gameId: string, password?: string) => {
  roomCodeError.value = null
  await runPending(pendingActionKeys.joinGame(gameId), async () => {
    try {
      enterGame(await GameService.joinGame(gameId, undefined, password))
    } catch (error) {
      roomCodeError.value = errorMessage(error, t('ui_error_room_not_found'))
      notifyError(error)
    }
  })
}

const rejoinGame = async (gameId: string) => {
  await runPending(pendingActionKeys.rejoinGame(gameId), async () => {
    try {
      const game = await GameService.rejoinGame(gameId)
      if (game.gameIsStarted) {
        onGameStart(game)
      } else {
        enterGame(game)
      }
    } catch (error) {
      notifyError(error)
    }
  })
}

const spectateGame = async (gameId: string) => {
  await runPending(pendingActionKeys.spectateGame(gameId), async () => {
    try {
      isSpectator.value = true
      const game = await GameService.joinSpectator(gameId)
      if (game.gameIsStarted) {
        onGameStart(game)
      } else {
        enterGame(game)
      }
    } catch (error) {
      isSpectator.value = false
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
  showResultPanel.value = false
  showRoom.value = false
}

/**
 * Возвращает игрока в последнюю начатую партию после перезагрузки страницы
 * или восстановления связи. Серверная сессия уже подтверждена, поэтому
 * остаётся только заново привязать сокет к своему слоту.
 */
let restoreInFlight = false

const restoreLastGame = async () => {
  if (restoreInFlight) return
  const gameId = activeGameId ?? localStorage.getItem(LAST_GAME_STORAGE_KEY)
  if (!gameId) return

  restoreInFlight = true
  try {
    const game = await GameService.rejoinGame(gameId)
    if (game.gameIsStarted) {
      onGameStart(game)
    } else {
      enterGame(game)
    }
  } catch (error) {
    // Партия удалена или игрок вышел из неё на другом устройстве: держать
    // устаревшую метку незачем. Сетевые ошибки не трогают её — следующая
    // попытка после восстановления соединения повторится.
    if (
      error instanceof SocketAckError &&
      (error.code === 'common.game_not_found' ||
        error.code === 'common.player_not_found_in_game')
    ) {
      forgetLastGame()
      clearSession()
      gameState.value = {} as IGameBoard
      showLobby.value = true
    }
  } finally {
    restoreInFlight = false
  }
}

const gameDeletedMessage = (reason: GameDeletedPayload['reason']): string =>
  t(`ui_game_deleted_${reason}`)

const onGameDeleted = (payload: GameDeletedPayload) => {
  const deletedGameId =
    activeGameId ?? currentGame.value?.id ?? gameState.value.id
  notificationService.warning(gameDeletedMessage(payload.reason))

  if (
    deletedGameId &&
    localStorage.getItem(LAST_GAME_STORAGE_KEY) === deletedGameId
  ) {
    forgetLastGame()
  }

  clearSession()
  gameState.value = {} as IGameBoard
  showLobby.value = true
  getGamesList()
}

/**
 * Подтверждает выход, только если партия уже начата. Игрок не должен
 * случайно потерять управление ходом в разыгранной партии.
 */
const confirmLeaveActiveGame = (): boolean => {
  if (!gameState.value.gameIsStarted) return true
  return window.confirm(t('ui_confirm_leave_active_game'))
}

const leaveGame = async () => {
  if (!confirmLeaveActiveGame()) return
  await runPending(pendingActionKeys.leaveGame(), async () => {
    try {
      await GameService.leaveGame()
      forgetLastGame()
      clearSession()
      getGamesList()
    } catch (error) {
      notifyError(error)
    }
  })
}

const goInLobby = async () => {
  if (!confirmLeaveActiveGame()) return
  await runPending(pendingActionKeys.leaveGame(), async () => {
    try {
      if (!isSpectator.value) {
        await GameService.leaveGame()
      }
      forgetLastGame()
      clearSession()
      isSpectator.value = false
      showLobby.value = true
      gameState.value = {} as IGameBoard
      getGamesList()
    } catch (error) {
      notifyError(error)
    }
  })
}

const createGame = async (options: CreateGameOptions) => {
  createGameError.value = null
  await runPending(pendingActionKeys.createGame(), async () => {
    try {
      const game = await GameService.createGame(options)
      currentGame.value = game
      playersList.value = game.players
      showRoom.value = true
    } catch (error) {
      createGameError.value = errorMessage(error, t('ui_error_create_game'))
      notifyError(error)
    }
  })
}

/**
 * Новая партия с теми же правилами.
 *
 * Прежняя партия покидается: игрок не может остаться сразу в двух партиях.
 */
const playAgain = async () => {
  if (!confirmLeaveActiveGame()) return
  const rules = gameState.value.rules
  const finalScoringEnabled = gameState.value.finalScoringEnabled ?? false

  const left = await runPending(pendingActionKeys.leaveGame(), async () => {
    try {
      await GameService.leaveGame()
      forgetLastGame()
      clearSession()
      showLobby.value = true
      return true
    } catch (error) {
      notifyError(error, t('ui_error_leave_game'))
      return false
    }
  })

  if (!left) return

  await createGame({
    finalScoringEnabled,
    innsAndCathedralsEnabled: rules?.expansions?.innsAndCathedrals ?? false,
    riverEnabled: rules?.expansions?.river ?? false,
    princessAndDragonEnabled: rules?.expansions?.princessAndDragon ?? false,
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
  const ownerSessionId = currentGame.value?.ownerSessionId
  if (!ownerSessionId) return false
  return ownerSessionId === GameService.sessionId.value
})

/** Состояние связи для индикатора и полноэкранного восстановления. */
const connectionView = computed(() =>
  describeConnectionStatus({
    phase: GameService.connectionPhase.value,
    isOnline: GameService.isOnline.value,
    reconnectAttempt: GameService.reconnectAttempt.value,
    lastDisconnectReason: GameService.lastDisconnectReason.value,
    errorCode: GameService.connectionErrorCode.value,
  })
)

const playersReconnectProcess = computed(() => {
  return !gameState.value.gameIsEnded && reconnectingPlayers.value?.length > 0
})

const reconnectingPlayers = computed(() => {
  return gameState.value.players?.filter(
    (player) => !player.isConnected && player.sessionId
  )
})

const games = ref<LobbyGame[]>([])
const isGamesListLoading = ref(true)
const playersList = ref<PlayerView[]>([])
const currentGame = ref<IGame | null>(null)

const gamesListError = ref<string | null>(null)
const roomCodeError = ref<string | null>(null)
const createGameError = ref<string | null>(null)

const showRules = ref(false)
const rulesDocument = ref<RulesDocument | null>(null)

/** Пункты меню: итоги партии появляются, когда партия закончилась. */
const menuItems = computed<GameMenuItem[]>(() => {
  const items: GameMenuItem[] = [
    { id: 'rules', label: t('ui_menu_rules'), icon: 'i-lucide-circle-help' },
    {
      id: 'language',
      label: languageLabel.value,
      icon: 'i-lucide-globe',
    },
  ]

  if (gameState.value.gameIsEnded) {
    items.push({
      id: 'result',
      label: t('ui_menu_result'),
      icon: 'i-lucide-trophy',
    })
  }

  return items
})

/** Надпись пункта смены языка: «Язык: Русский» / «Language: English». */
const languageLabel = computed(() => {
  const current = getLocale()
  const name = current === 'ru' ? t('ui_language_ru') : t('ui_language_en')
  return `${t('ui_menu_language')}: ${name}`
})

/** Переключает язык приложения и сохраняет выбор. */
const toggleLanguage = async (): Promise<void> => {
  setLocale(getLocale() === 'ru' ? 'en' : 'ru')
  GameService.notifyLocaleChange(getLocale())
  if (rulesDocument.value) {
    const { getBaseGameRules } = await import('./rules/baseGame')
    rulesDocument.value = getBaseGameRules()
  }
  notificationService.info(t('ui_language_changed'))
}

/**
 * Сброс расположения окон.
 *
 * Окна возвращаются на исходные места и разворачиваются, сохранённая
 * раскладка удаляется.
 */
const onResetLayout = () => {
  resetPanelLayout()
  notificationService.info(t('ui_layout_reset'))
}

const onMenuSelect = async (id: string) => {
  if (id === 'language') {
    await toggleLanguage()
    return
  }
  if (id === 'result') {
    showResultPanel.value = true
    return
  }

  if (id === 'rules') {
    try {
      const { getBaseGameRules } = await import('./rules/baseGame')
      rulesDocument.value = getBaseGameRules()
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

const reloadApp = () => {
  window.location.reload()
}

onMounted(() => {
  const unsubscribeGameUpdated = GameService.onGameUpdated(onGameUpdated)
  const unsubscribeGameDeleted = GameService.onGameDeleted(onGameDeleted)
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
  const unsubscribeSessionReplaced = GameService.onSocketEvent(
    SocketEvents.SessionReplaced,
    () => {
      notificationService.warning(t('ui_session_replaced'))
    }
  )

  // После подтверждения сессии — и при первом запуске, и после разрыва —
  // возвращаем игрока в его незавершённую партию.
  const stopSessionWatch = watch(
    () => GameService.sessionReady.value,
    (ready) => {
      if (ready) void restoreLastGame()
    },
    { immediate: true }
  )

  GameService.connect()

  // Предупреждение при закрытии страницы во время разыгранной партии.
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (gameState.value.gameIsStarted) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  window.addEventListener('beforeunload', onBeforeUnload)

  cleanupSocketListeners = () => {
    window.removeEventListener('beforeunload', onBeforeUnload)
    unsubscribeGameUpdated()
    unsubscribeGameDeleted()
    unsubscribeGamesList()
    unsubscribeConnect()
    unsubscribeSessionReplaced()
    stopSessionWatch()
  }
})
</script>
