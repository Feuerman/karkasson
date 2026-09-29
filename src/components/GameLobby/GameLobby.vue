<template>
  <div
    class="absolute inset-0 z-[3000] flex h-full w-full flex-col items-center overflow-y-auto bg-[#241c10]/75 p-6 text-text backdrop-blur-[2px]"
  >
    <ConnectionBadge :is-connected="gameService.isConnected.value" />

    <!-- Лобби: выбор игры -->
    <div
      v-if="!currentGame?.id"
      class="panel-parchment animate-fade-rise my-auto w-full max-w-[880px] p-5 sm:p-7"
    >
      <LobbyHeader
        icon="i-lucide-chess-knight"
        title="Каркассон"
        subtitle="Стройте средневековые земли вместе с друзьями"
      />

      <LoadingState
        v-if="!gameService.isConnected.value"
        message="Идёт соединение с сервером..."
      />

      <LoadingState
        v-else-if="isLoadingGames"
        message="Загрузка списка игр..."
      />

      <div v-else class="flex flex-col items-stretch gap-3">
        <div class="mb-1 flex flex-wrap items-center justify-between gap-4">
          <UCheckbox
            label="Показать оконченные"
            color="primary"
            :model-value="Boolean(showEndedGames)"
            :ui="{ label: '!text-base' }"
            class="text-base text-text-muted"
            @update:model-value="showEndedGames = !showEndedGames"
          />
          <UButton
            color="primary"
            class="btn-primary-action min-h-11 cursor-pointer gap-2 rounded-lg px-6 py-2.5 text-base font-semibold shadow-soft"
            @click="isCreateGameModalOpen = true"
          >
            <template #leading>
              <UIcon name="i-lucide-plus" class="h-5 w-5" />
            </template>
            Создать новую игру
          </UButton>
        </div>

        <label
          class="flex flex-col gap-1.5 text-sm font-medium text-text-muted"
        >
          Найти комнату по номеру
          <input
            v-model="roomCodeSearch"
            type="search"
            inputmode="numeric"
            autocomplete="off"
            placeholder="Например, 482731"
            class="min-h-11 rounded-lg border border-gold-dark/40 bg-white/80 px-3 text-base text-text outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            @keydown.enter.prevent="joinByRoomCode"
          />
        </label>

        <div
          class="flex max-h-[52vh] min-h-[320px] flex-col gap-2.5 overflow-y-auto pb-1 pr-1"
        >
          <UEmpty
            v-if="computedGamesList.length === 0"
            icon="i-lucide-castle"
            :title="roomCodeSearch ? 'Комната не найдена' : 'Нет текущих игр'"
            :description="
              roomCodeSearch
                ? 'Проверьте номер комнаты и попробуйте снова'
                : 'Создайте новую игру или присоединитесь к существующей'
            "
            class="mx-auto my-auto opacity-80"
          />
          <template v-else>
            <GameCard
              v-for="game in computedGamesList"
              :key="game.id"
              :game="game"
              :device-id="gameService.deviceId"
              @join="joinGame"
              @rejoin="rejoinGame"
            />
          </template>
        </div>
      </div>
    </div>

    <UModal
      v-model:open="isCreateGameModalOpen"
      title="Создание игры"
      description="Настройте правила новой партии"
    >
      <template #body>
        <UCheckbox
          label="Финальный подсчёт очков"
          color="primary"
          :model-value="finalScoringEnabled"
          :ui="{ label: '!text-base' }"
          class="text-base text-text"
          @update:model-value="finalScoringEnabled = Boolean($event)"
        />
        <p class="mt-2 text-sm leading-relaxed text-text-muted">
          Если включить опцию, в конце партии очки начислятся за незавершённые
          дороги, города, монастыри и сады. По умолчанию выключено.
        </p>
        <UCheckbox
          label="Таверны и соборы"
          color="primary"
          :model-value="innsAndCathedralsEnabled"
          :ui="{ label: '!text-base' }"
          class="mt-4 text-base text-text"
          @update:model-value="innsAndCathedralsEnabled = Boolean($event)"
        />
        <p class="mt-2 text-sm leading-relaxed text-text-muted">
          Добавляет 18 тайлов дополнения и большого подданного. По умолчанию
          выключено.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton
            color="neutral"
            variant="outline"
            class="cursor-pointer"
            @click="isCreateGameModalOpen = false"
          >
            Отмена
          </UButton>
          <UButton
            color="primary"
            class="btn-primary-action cursor-pointer"
            @click="createGame"
          >
            Создать игру
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Лобби: готовность к старту -->
    <div
      v-if="currentGame?.id"
      class="panel-parchment animate-fade-rise my-auto mt-8 w-full max-w-[680px] p-5 sm:p-7"
    >
      <LobbyHeader
        icon="i-lucide-swords"
        :title="`Комната № ${currentGame?.roomCode ?? '—'}`"
        subtitle="Займите свободные слоты или оставьте их искусственному интеллекту"
        size="md"
      />

      <p class="mt-3 text-center text-sm text-text-muted">
        Финальный подсчёт очков:
        <strong class="text-text">
          {{ currentGame.finalScoringEnabled ? 'включён' : 'выключен' }}
        </strong>
      </p>
      <p class="text-center text-sm text-text-muted">
        Таверны и соборы:
        <strong class="text-text">
          {{
            currentGame.rules?.expansions.innsAndCathedrals
              ? 'включены'
              : 'выключены'
          }}
        </strong>
      </p>

      <LoadingState
        v-if="!gameService.isConnected.value"
        message="Идёт соединение с сервером..."
      />

      <div v-else class="flex flex-col items-center">
        <div class="my-4 mb-6 grid w-full max-w-[500px] grid-cols-1 gap-3">
          <PlayerSlot
            v-for="(player, index) in players"
            :key="player.id"
            :player="player"
            :index="index"
            :device-id="gameService.deviceId"
            @toggle-checkbox="toggleCheckbox"
            @name-input="currentPlayerName = $event"
            @toggle-button="toggleButton"
          />
        </div>

        <div class="mt-2 flex flex-wrap justify-center gap-4">
          <UButton
            class="btn-stone min-h-12 min-w-[200px] px-7 py-3 text-base font-bold"
            @click="emit('leaveGame')"
          >
            Отключиться
          </UButton>
          <UButton
            v-if="isLobbyCreator"
            class="btn-stone min-h-12 min-w-[200px] px-7 py-3 text-base font-bold"
            @click="startGame"
          >
            Начать игру
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import GameService from '@/modules/GameService'
import type { CreateGameOptions } from '@/modules/GameService'
import { notifyError } from '@/utils/common'
import type { IGame, IGameBoard, LobbyGame } from '@/types/game'
import type { Player } from '@server/modules/types'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import ConnectionBadge from './internal/ConnectionBadge.vue'
import LobbyHeader from './internal/LobbyHeader.vue'
import LoadingState from './internal/LoadingState.vue'
import GameCard from './internal/GameCard.vue'
import PlayerSlot from './internal/PlayerSlot.vue'

const props = withDefaults(
  defineProps<{
    gameState?: IGameBoard
    gamesList?: LobbyGame[]
    players?: Player[]
    currentGame?: IGame | null
  }>(),
  {
    gameState: () => ({}) as IGameBoard,
    gamesList: () => [],
    players: () => [],
    currentGame: null,
  }
)

const emit = defineEmits<{
  createGame: [options: CreateGameOptions]
  joinGame: [gameId: string]
  rejoinGame: [gameId: string]
  leaveGame: []
  startGame: []
  gameStarted: [game: IGame]
  updateGamesList: []
}>()

const gameService = GameService

const isLobbyCreator = computed(() => {
  const creator = props.currentGame?.players[0]
  if (!creator) return false

  return Boolean(
    (creator.deviceId && creator.deviceId === gameService.deviceId) ||
    (creator.socketId &&
      gameService.socket?.id &&
      creator.socketId === gameService.socket.id)
  )
})

const currentPlayerName = ref('')
const showEndedGames = ref(false)
const finalScoringEnabled = ref(false)
const innsAndCathedralsEnabled = ref(false)
const isCreateGameModalOpen = ref(false)
const roomCodeSearch = ref('')
const isLoadingGames = ref(true)
let initialLoadingTimeout: ReturnType<typeof setTimeout> | undefined

const computedGamesList = computed<LobbyGame[]>(() =>
  (showEndedGames.value
    ? props.gamesList
    : props.gamesList.filter((g) => !g.gameIsEnded)
  ).filter((game) =>
    game.roomCode.includes(roomCodeSearch.value.trim().toUpperCase())
  )
)

function joinByRoomCode() {
  const roomCode = roomCodeSearch.value.trim()
  if (/^\d{6}$/.test(roomCode)) emit('joinGame', roomCode)
}

function createGame() {
  isCreateGameModalOpen.value = false
  emit('createGame', {
    finalScoringEnabled: finalScoringEnabled.value,
    innsAndCathedralsEnabled: innsAndCathedralsEnabled.value,
  })
}

onMounted(() => {
  // Simulate initial games loading
  initialLoadingTimeout = setTimeout(() => {
    initialLoadingTimeout = undefined
    isLoadingGames.value = false
  }, 1000)
})

onBeforeUnmount(() => {
  clearTimeout(initialLoadingTimeout)
})

function joinGame(gameId: string | undefined) {
  if (gameId === undefined) return
  emit('joinGame', gameId)
}

function rejoinGame(gameId: string | undefined) {
  if (gameId === undefined) return
  emit('rejoinGame', gameId)
}

async function addPlayer(player: { name?: string | null }, index: number) {
  try {
    await GameService.addPlayer({ name: player.name ?? '', index })
    currentPlayerName.value = ''
  } catch (error) {
    notifyError(error)
  }
}

async function removePlayer(index: number, name: string | null = null) {
  try {
    await GameService.removePlayer(index, name)
  } catch (error) {
    notifyError(error)
  }
}

function toggleCheckbox(player: Player, index: number) {
  if (player.socketId || player.name) {
    removePlayer(index)
  } else {
    addPlayer(player, index)
  }
}

function toggleButton(player: Player, index: number) {
  if (player.socketId) {
    removePlayer(index, player.name)
  } else {
    addPlayer({ name: currentPlayerName.value || player.name }, index)
  }
}

async function startGame() {
  try {
    await GameService.startGame()
    emit('startGame')
  } catch (error) {
    notifyError(error)
  }
}
</script>
