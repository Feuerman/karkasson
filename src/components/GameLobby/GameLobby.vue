<template>
  <div
    class="absolute inset-0 z-[3000] flex h-full w-full flex-col items-center overflow-y-auto bg-overlay/75 p-6 text-text backdrop-blur-[2px]"
  >
    <!-- Лобби: выбор игры -->
    <div
      v-if="!currentGame?.id || !showRoom"
      class="panel-parchment animate-fade-rise my-auto w-full max-w-[880px] p-5 sm:p-7"
    >
      <LobbyHeader
        icon="i-lucide-chess-knight"
        :title="t('lobby_title')"
        :subtitle="t('lobby_subtitle')"
      />

      <LoadingState v-if="!isConnected" :message="t('lobby_connecting')" />

      <LoadingState
        v-else-if="isGamesListLoading"
        :message="t('lobby_loading_games')"
      />

      <div v-else class="flex flex-col items-stretch gap-3">
        <div class="mb-1 flex flex-wrap items-center justify-between gap-4">
          <UCheckbox
            :label="t('lobby_show_ended')"
            color="primary"
            :model-value="Boolean(showEndedGames)"
            :ui="{ label: '!text-base' }"
            class="text-base text-text-muted items-center"
            @update:model-value="showEndedGames = !showEndedGames"
          />
          <UButton
            color="primary"
            :data-testid="TEST_IDS.lobbyCreateGame"
            class="btn-primary-action min-h-11 cursor-pointer gap-2 rounded-lg px-6 py-2.5 text-base font-semibold shadow-soft"
            @click="isCreateGameModalOpen = true"
          >
            <template #leading>
              <UIcon name="i-lucide-plus" class="h-5 w-5" />
            </template>
            {{ t('lobby_create_game') }}
          </UButton>
          <UButton
            color="secondary"
            :data-testid="TEST_IDS.lobbyGoogleLogin"
            class="min-h-11 cursor-pointer gap-2 rounded-lg px-6 py-2.5 text-base font-semibold shadow-soft"
            :loading="isGoogleLoginPending"
            @click="loginWithGoogle"
          >
            <template #leading>
              <UIcon name="i-lucide-mail" class="h-5 w-5" />
            </template>
            {{ t('lobby_google_login') }}
          </UButton>
        </div>

        <label
          class="flex flex-col gap-1.5 text-sm font-medium text-text-muted"
        >
          {{ t('lobby_find_room') }}
          <input
            v-model="roomCodeSearch"
            :data-testid="TEST_IDS.lobbyRoomSearch"
            :disabled="isRoomCodeJoinPending"
            type="search"
            inputmode="numeric"
            autocomplete="off"
            :placeholder="t('lobby_room_placeholder')"
            class="min-h-11 rounded-lg border border-secondary-dark/40 bg-white/80 px-3 text-body text-text outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
            @keydown.enter.prevent="joinByRoomCode"
          />
        </label>

        <label
          v-if="roomCodeSearch.trim().length > 0"
          class="flex flex-col gap-1.5 text-sm font-medium text-text-muted"
        >
          {{ t('lobby_password_label') }}
          <UInput
            v-model="roomCodePassword"
            type="password"
            :disabled="isRoomCodeJoinPending"
            :placeholder="t('lobby_password_placeholder')"
            class="min-h-11 rounded-lg border border-secondary-dark/40 bg-white/80 px-3 text-body text-text outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/30"
            @keydown.enter.prevent="joinByRoomCode"
          />
        </label>

        <p v-if="roomCodeError" class="mb-2 text-sm text-negative">
          {{ roomCodeError }}
        </p>

        <div v-if="gamesListError" class="flex flex-col items-center gap-2">
          <UEmpty
            icon="i-lucide-alert-circle"
            :title="t('ui_error_games_list')"
            :description="gamesListError"
            class="mx-auto my-auto opacity-80"
          />
          <UButton color="primary" @click="emit('retryGamesList')">
            {{ t('lobby_retry') }}
          </UButton>
        </div>
        <div
          v-else
          class="flex max-h-[52vh] min-h-[320px] flex-col gap-2.5 overflow-y-auto pb-1 pr-1"
        >
          <UEmpty
            v-if="computedGamesList.length === 0"
            icon="i-lucide-castle"
            :title="
              roomCodeSearch ? t('lobby_room_not_found') : t('lobby_no_games')
            "
            :description="
              roomCodeSearch ? t('lobby_check_room') : t('lobby_create_or_join')
            "
            class="mx-auto my-auto opacity-80"
          />
          <template v-else>
            <GameCard
              v-for="game in computedGamesList"
              :key="game.id"
              :game="game"
              :session-id="sessionId"
              :pending="isGamePending(game)"
              @join="joinGame"
              @rejoin="rejoinGame"
            />
          </template>
        </div>
      </div>
    </div>

    <CreateGameModal
      v-model:open="isCreateGameModalOpen"
      :pending="isCreateGamePending"
      :error="createGameError"
      @create="createGame"
    />

    <!-- Лобби: готовность к старту -->
    <div
      v-if="currentGame?.id && showRoom"
      class="panel-parchment animate-fade-rise my-auto mt-8 w-full max-w-[680px] p-5 sm:p-7"
    >
      <LobbyHeader
        icon="i-lucide-swords"
        :title="t('lobby_room_title', { code: currentGame?.roomCode ?? '—' })"
        :subtitle="t('lobby_room_subtitle')"
        size="md"
        :data-testid="TEST_IDS.lobbyRoomHeading"
      />

      <RoomCodeCopy
        :room-code="props.currentGame?.roomCode"
        :test-id="TEST_IDS.lobbyCopyRoomCode"
      />

      <div class="mt-3">
        <RuleStatusLine
          v-for="rule in activeGameRules"
          :key="rule.label"
          :label="rule.label"
          :enabled="rule.enabled"
          :test-id="rule.testId"
        />
      </div>

      <LoadingState v-if="!isConnected" :message="t('lobby_connecting')" />

      <div v-else class="flex flex-col items-center">
        <div class="my-4 mb-6 flex w-full max-w-[500px] flex-col gap-5">
          <PlayerSlotsList
            :slots="occupiedSlots"
            :title="t('lobby_players')"
            :session-id="sessionId"
            :pending="isSlotPending"
            @toggle-checkbox="toggleCheckbox"
            @name-input="currentPlayerName = $event"
            @toggle-button="toggleButton"
          />
          <PlayerSlotsList
            :slots="freeSlots"
            :title="t('lobby_free_slots')"
            :session-id="sessionId"
            :pending="isSlotPending"
            @toggle-checkbox="toggleCheckbox"
            @name-input="currentPlayerName = $event"
            @toggle-button="toggleButton"
          />
        </div>

        <div class="mt-2 flex flex-wrap justify-center gap-4">
          <UButton
            class="btn-stone min-h-12 min-w-[200px] px-7 py-3 text-base font-bold"
            :loading="isLeaveGamePending"
            :data-testid="TEST_IDS.lobbyLeaveRoom"
            @click="emit('leaveGame')"
          >
            {{ t('lobby_leave_room') }}
          </UButton>
          <UButton
            class="btn-secondary min-h-12 min-w-[200px] px-7 py-3 text-base font-bold"
            :data-testid="TEST_IDS.lobbyBackToList"
            @click="emit('backToList')"
          >
            {{ t('lobby_back_to_list') }}
          </UButton>
          <UButton
            v-if="isCreator"
            :data-testid="TEST_IDS.lobbyStartGame"
            class="btn-stone min-h-12 min-w-[200px] px-7 py-3 text-base font-bold"
            :loading="isStartGamePending"
            :disabled="isStartGamePending"
            @click="emit('startGame')"
          >
            {{ t('lobby_start_game') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CreateGameOptions } from '@/modules/GameService'
import GameService from '@/modules/GameService'
import { TEST_IDS } from '@/data/testIds'
import { pendingActionKeys } from '@/composables/usePendingActions'
import type { IGame, LobbyGame } from '@/types/game'
import type { PlayerView } from '@server/modules/types'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import LobbyHeader from './internal/LobbyHeader.vue'
import LoadingState from './internal/LoadingState.vue'
import GameCard from './internal/GameCard.vue'
import PlayerSlotsList from './internal/PlayerSlotsList.vue'
import RuleStatusLine from './internal/RuleStatusLine.vue'
import CreateGameModal from './internal/CreateGameModal.vue'
import RoomCodeCopy from './internal/RoomCodeCopy.vue'
import { buildGameRules, isRejoinable } from './internal/helpers'
import { t } from '@/utils/i18n'
import { notifyError } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    gamesList?: LobbyGame[]
    players?: PlayerView[]
    currentGame?: IGame | null
    /** Подключение и идентификация приходят из слоя транспорта. */
    isConnected?: boolean
    isCreator?: boolean
    isGamesListLoading?: boolean
    /** Показывать комнату, а не список партий. */
    showRoom?: boolean
    /** Ключи команд, ожидающих ответа сервера: показываем индикатор занятости. */
    pendingActions?: string[]
    sessionId?: string
    /** Ошибка загрузки списка партий: показываем вместо списка с кнопкой повтора. */
    gamesListError?: string | null
    /** Ошибка поиска комнаты по коду: показываем под полем ввода. */
    roomCodeError?: string | null
    /** Ошибка создания партии: показываем в модалке создания. */
    createGameError?: string | null
  }>(),
  {
    gamesList: () => [],
    players: () => [],
    currentGame: null,
    isConnected: false,
    isCreator: false,
    isGamesListLoading: false,
    showRoom: false,
    pendingActions: () => [],
    sessionId: '',
    gamesListError: null,
    roomCodeError: null,
    createGameError: null,
  }
)

const emit = defineEmits<{
  createGame: [options: CreateGameOptions]
  joinGame: [gameId: string, password?: string]
  rejoinGame: [gameId: string]
  leaveGame: []
  backToList: []
  addPlayer: [name: string, index: number]
  removePlayer: [index: number, keepAsComputer: boolean]
  startGame: []
  retryGamesList: []
}>()

/** Слоты с игроками и свободные слоты: показываются отдельными списками. */
const slotsWithIndex = computed(() =>
  props.players.map((player, index) => ({ player, index }))
)

const occupiedSlots = computed(() =>
  slotsWithIndex.value.filter(({ player }) => Boolean(player.name))
)

const freeSlots = computed(() =>
  slotsWithIndex.value.filter(({ player }) => !player.name)
)

const activeGameRules = computed(() => {
  const game = props.currentGame
  if (!game) return []
  return buildGameRules(game)
})

const currentPlayerName = ref('')
const showEndedGames = ref(false)
const isCreateGameModalOpen = ref(false)
const roomCodeSearch = ref('')
const roomCodePassword = ref('')
const isGoogleLoginPending = ref(false)

const isPendingAction = (key: string) => props.pendingActions.includes(key)

const isSlotPending = (index: number) =>
  isPendingAction(pendingActionKeys.slot(index))

const isCreateGamePending = computed(() =>
  isPendingAction(pendingActionKeys.createGame())
)

const isStartGamePending = computed(() =>
  isPendingAction(pendingActionKeys.startGame())
)

const isLeaveGamePending = computed(() =>
  isPendingAction(pendingActionKeys.leaveGame())
)

const gameJoinKey = (game: LobbyGame) =>
  isRejoinable(game, props.sessionId)
    ? pendingActionKeys.rejoinGame(game.id ?? '')
    : pendingActionKeys.joinGame(game.id ?? '')

const isGamePending = (game: LobbyGame) => isPendingAction(gameJoinKey(game))

const isRoomCodeJoinPending = computed(() =>
  isPendingAction(pendingActionKeys.joinGame(roomCodeSearch.value.trim()))
)

const computedGamesList = computed<LobbyGame[]>(() =>
  (showEndedGames.value
    ? props.gamesList
    : props.gamesList.filter((g) => !g.gameIsEnded)
  ).filter((game) =>
    game.roomCode.includes(roomCodeSearch.value.trim().toUpperCase())
  )
)

function joinByRoomCode() {
  if (isRoomCodeJoinPending.value) return
  const roomCode = roomCodeSearch.value.trim()
  if (/^\d{6}$/.test(roomCode))
    emit('joinGame', roomCode, roomCodePassword.value)
}

function createGame(options: CreateGameOptions) {
  if (isCreateGamePending.value) return
  emit('createGame', options)
}

async function loginWithGoogle() {
  if (isGoogleLoginPending.value) return
  isGoogleLoginPending.value = true
  try {
    await GameService.linkAccount()
  } catch (error) {
    notifyError(error)
  } finally {
    isGoogleLoginPending.value = false
  }
}

function joinGame(gameId: string | undefined) {
  if (gameId === undefined) return
  emit('joinGame', gameId)
}

function rejoinGame(gameId: string | undefined) {
  if (gameId === undefined) return
  emit('rejoinGame', gameId)
}

function addPlayer(name: string | null | undefined, index: number) {
  emit('addPlayer', name ?? '', index)
  currentPlayerName.value = ''
}

function toggleCheckbox(player: PlayerView, index: number) {
  if (player.isConnected || player.name) {
    emit('removePlayer', index, false)
  } else {
    addPlayer(player.name, index)
  }
}

function toggleButton(player: PlayerView, index: number) {
  if (player.isConnected) {
    emit('removePlayer', index, true)
  } else {
    addPlayer(currentPlayerName.value || player.name, index)
  }
}
</script>
