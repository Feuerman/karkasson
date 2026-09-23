<template>
  <div
    class="absolute inset-0 z-[3000] flex h-full w-full flex-col items-center overflow-y-auto bg-[#241c10]/75 p-6 text-text backdrop-blur-[2px]"
  >
    <div class="fixed right-4 top-4 z-[3001] flex items-center gap-2">
      <UBadge
        :color="connectionColor"
        variant="subtle"
        class="rounded-full border border-gold-dark/40 bg-surface/95 px-4 py-2 text-text-muted shadow-soft"
      >
        <template #leading>
          <span
            class="h-2.5 w-2.5 rounded-full transition-colors duration-300"
            :class="connectionDotClass"
          ></span>
        </template>
        {{ gameService.isConnected.value ? 'Подключено' : 'Отключено' }}
      </UBadge>
    </div>

    <!-- Лобби: выбор игры -->
    <div
      v-if="!currentGame?.id"
      class="panel-parchment animate-fade-rise my-auto w-full max-w-[880px] p-5 sm:p-7"
    >
      <div class="mb-5 flex flex-col items-center gap-1.5 text-center">
        <div
          class="title-medieval mb-2 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-gold-dark bg-gradient-to-br from-[#6b4c26] to-[#43301a] shadow-soft"
        >
          <UIcon name="i-lucide-chess-knight" class="h-8 w-8 text-gold" />
        </div>
        <h1
          class="title-medieval m-0 text-[2.4rem] leading-none text-[#5a4125]"
        >
          Каркассон
        </h1>
        <p class="m-0 text-lg text-text-muted">
          Стройте средневековые земли вместе с друзьями
        </p>
      </div>

      <div
        v-if="!gameService.isConnected.value"
        class="flex flex-col items-center justify-center gap-4 rounded-lg p-8"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="h-10 w-10 animate-spin text-gold-dark"
        />
        <p class="m-0 text-center text-[1.2rem] text-text-muted">
          Идёт соединение с сервером...
        </p>
      </div>

      <div
        v-else-if="isLoadingGames"
        class="flex flex-col items-center justify-center gap-4 rounded-lg p-8"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="h-10 w-10 animate-spin text-gold-dark"
        />
        <p class="m-0 text-center text-[1.2rem] text-text-muted">
          Загрузка списка игр...
        </p>
      </div>

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
            class="cursor-pointer px-6 py-2.5 text-base text-white"
            @click="createGame"
          >
            <template #leading>
              <UIcon name="i-lucide-plus" class="h-5 w-5" />
            </template>
            Создать новую игру
          </UButton>
        </div>

        <div
          class="flex max-h-[52vh] min-h-[320px] flex-col gap-2.5 overflow-y-auto pb-1 pr-1"
        >
          <UEmpty
            v-if="computedGamesList.length === 0"
            icon="i-lucide-castle"
            title="Нет текущих игр"
            description="Создайте новую игру или присоединитесь к существующей"
            class="mx-auto my-auto opacity-80"
          />
          <template v-else>
            <div
              v-for="game in computedGamesList"
              :key="game.id"
              class="group flex cursor-pointer flex-col gap-3 rounded-xl border border-gold-dark/30 bg-gradient-to-br from-wood to-wood-dark p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/70 hover:shadow-card sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <div class="flex items-center gap-2 text-[#f3e7c8]">
                  <UIcon
                    name="i-lucide-flag"
                    class="h-[18px] w-[18px] text-gold"
                  />
                  <span class="title-medieval text-base tracking-wide">
                    Игра № {{ game.id }}
                  </span>
                </div>

                <span
                  v-if="game.isLastGame"
                  class="flex items-center gap-1 rounded-full border border-gold/50 bg-gold/15 px-2 py-0.5 text-xs uppercase tracking-wide text-gold"
                >
                  <UIcon name="i-lucide-history" class="h-3.5 w-3.5" />
                  Последняя
                </span>

                <div
                  class="flex items-center gap-1.5 text-[1.05rem] text-[#d9c9a3]"
                >
                  <UIcon
                    name="i-lucide-users"
                    class="h-[18px] w-[18px] text-gold"
                  />
                  {{ game.players?.length }}
                </div>

                <div
                  v-if="game.gameIsStarted && !game.gameIsEnded"
                  class="flex items-center gap-1.5 text-[1.05rem] text-[#d9c9a3]"
                >
                  <UIcon
                    name="i-lucide-footprints"
                    class="h-[18px] w-[18px] text-gold"
                  />
                  Ход {{ game.moveCounter }}
                </div>
                <div
                  v-else-if="game.gameIsEnded"
                  class="flex items-center gap-1.5 text-[1.05rem] text-[#d9c9a3]"
                >
                  <UIcon
                    name="i-lucide-trophy"
                    class="h-[18px] w-[18px] text-gold"
                  />
                  Окончена
                </div>
                <div
                  v-else
                  class="flex items-center gap-1.5 text-[1.05rem] text-[#d9c9a3]"
                >
                  <UIcon
                    name="i-lucide-hourglass"
                    class="h-[18px] w-[18px] text-gold"
                  />
                  Ожидание игроков
                </div>
              </div>

              <div
                v-if="game.gameIsStarted"
                class="flex flex-wrap gap-x-4 gap-y-0.5 text-[1.05rem] text-[#e8d9b0]"
              >
                <span
                  v-for="(value, key, index) in game.scores"
                  :key="key"
                  class="flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span
                    class="h-2.5 w-2.5 rounded-full ring-1 ring-black/30"
                    :class="
                      playerBackgroundColorClass(game.players[index]?.color)
                    "
                  ></span>
                  <template
                    v-if="
                      !game.players[index].socketId &&
                      !game.players[index].deviceId &&
                      game.players[index].name
                    "
                  >
                    AI
                  </template>
                  {{ game.players[index]?.name }} — {{ value }}
                </span>
              </div>

              <UButton
                v-if="!currentGame?.id"
                class="flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 border border-gold-dark/60 bg-gold/15 text-base text-[#f7e7bb] sm:w-[180px]"
                color="neutral"
                @click="
                  isRejoinable(game) ? rejoinGame(game.id) : joinGame(game.id)
                "
              >
                <template #leading>
                  <UIcon
                    :name="joinButtonIcon(game)"
                    class="h-[18px] w-[18px]"
                  />
                </template>
                <template v-if="!game.gameIsStarted">Войти</template>
                <template v-else-if="game.gameIsStarted && !game.gameIsEnded"
                  >Продолжить</template
                >
                <template v-else>Загрузить</template>
              </UButton>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Лобби: готовность к старту -->
    <div
      v-if="currentGame?.id"
      class="panel-parchment animate-fade-rise my-auto mt-8 w-full max-w-[680px] p-5 sm:p-7"
    >
      <div class="mb-6 flex flex-col items-center gap-1.5 text-center">
        <div
          class="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-gold-dark bg-gradient-to-br from-[#6b4c26] to-[#43301a] shadow-soft"
        >
          <UIcon name="i-lucide-swords" class="h-7 w-7 text-gold" />
        </div>
        <h3 class="title-medieval m-0 text-2xl text-[#5a4125]">
          Лобби игры № {{ currentGame?.id }}
        </h3>
        <p class="m-0 text-base text-text-muted">
          Займите свободные слоты или оставьте их искусственному интеллекту
        </p>
      </div>

      <div
        v-if="!gameService.isConnected.value"
        class="flex flex-col items-center justify-center gap-4 rounded-lg p-8"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="h-10 w-10 animate-spin text-gold-dark"
        />
        <p class="m-0 text-center text-[1.2rem] text-text-muted">
          Идёт соединение с сервером...
        </p>
      </div>

      <div v-else class="flex flex-col items-center">
        <div class="my-4 mb-6 grid w-full max-w-[500px] grid-cols-1 gap-3">
          <div
            v-for="(player, index) in players"
            :key="player.id"
            class="flex items-center gap-3 rounded-xl border border-border bg-surface/70 py-2 pl-3 pr-4 shadow-soft"
          >
            <UCheckbox
              :class="playerTextColorClass(player.color)"
              :model-value="Boolean(player.name)"
              :disabled="
                Boolean(
                  player.socketId && player.deviceId !== gameService.deviceId
                )
              "
              @update:model-value="
                player.socketId || player.name
                  ? removePlayer(index)
                  : addPlayer(player, index)
              "
            />

            <UInput
              :model-value="player.name ?? ''"
              :placeholder="`Игрок ${index + 1}`"
              :disabled="Boolean(player.socketId || !player.name)"
              :ui="{
                input:
                  'border-2 text-lg ' +
                  playerBorderColorClass(player.name ? player.color : null),
              }"
              class="flex-1 rounded-lg bg-transparent font-semibold text-text"
              @update:model-value="onPlayerNameInput"
            />
            <div
              v-if="!player.socketId && player.name"
              class="text-base font-semibold text-text-muted"
            >
              ИИ
            </div>
            <UButton
              variant="outline"
              color="neutral"
              :class="[
                'flex h-10 w-[150px] shrink-0 items-center justify-center whitespace-nowrap px-4 text-base font-semibold text-text',
                canToggleSlot(player) ? '' : 'invisible',
              ]"
              :ui="{
                base:
                  'border-2 ' +
                  playerBorderColorClass(player.name ? player.color : null),
              }"
              @click="
                player.socketId
                  ? removePlayer(index, player.name)
                  : addPlayer({ name: currentPlayerName || player.name }, index)
              "
            >
              {{ !player.socketId ? 'Занять' : 'Освободить' }}
            </UButton>
          </div>
        </div>

        <div class="mt-2 flex flex-wrap justify-center gap-4">
          <UButton
            class="btn-stone min-w-[200px] px-7 py-3 text-base font-bold"
            @click="leaveGameAndGoBack"
          >
            Отключиться
          </UButton>
          <UButton
            class="btn-stone min-w-[200px] px-7 py-3 text-base font-bold"
            @click="startGame"
          >
            Начать игру
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import GameService from '@/modules/GameService'
import notificationService from '@/plugins/notification'
import type { IGame, IGameBoard } from '@/types/game'
import type { GameSummary } from '@server/services/GameService'
import type { Player } from '@server/modules/types'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import {
  playerBackgroundColorClass,
  playerBorderColorClass,
  playerTextColorClass,
} from '@/utils/colors'

const notifyError = (error: unknown) => {
  if (error instanceof Error) {
    notificationService.error(error.message)
  } else {
    notificationService.error(String(error))
  }
}

export default {
  name: 'GameLobby',
  components: {
    UBadge,
    UButton,
    UCheckbox,
    UEmpty,
    UIcon,
    UInput,
  },
  props: {
    gameState: {
      type: Object as () => IGameBoard,
      default: () => ({}),
    },
    gamesList: {
      type: Array as () => (GameSummary & { isLastGame?: boolean })[],
      default: () => [],
    },
    players: {
      type: Array as () => Player[],
      default: () => [],
    },
    currentGame: {
      type: Object as () => IGame | null,
      default: null,
    },
  },
  data() {
    return {
      currentPlayerName: '',
      showEndedGames: false,
      isLoadingGames: true,
    }
  },
  computed: {
    gameService() {
      return GameService
    },
    connectionColor(): 'success' | 'error' {
      return this.gameService.isConnected.value ? 'success' : 'error'
    },
    connectionDotClass(): string {
      return this.gameService.isConnected.value
        ? 'bg-[#44ff44]'
        : 'bg-[#ff4444]'
    },
    computedGamesList(): (GameSummary & { isLastGame?: boolean })[] {
      return this.showEndedGames
        ? this.gamesList
        : this.gamesList.filter((g) => !g.gameIsEnded)
    },
  },
  mounted() {
    // Simulate initial games loading
    setTimeout(() => {
      this.isLoadingGames = false
    }, 1000)
  },
  methods: {
    playerTextColorClass,
    playerBorderColorClass,
    playerBackgroundColorClass,
    joinButtonIcon(game: GameSummary): string {
      if (!game.gameIsStarted) return 'i-lucide-log-in'
      if (!game.gameIsEnded) return 'i-lucide-play'
      return 'i-lucide-download'
    },
    onPlayerNameInput(value: string) {
      this.currentPlayerName = value
    },
    async createGame() {
      try {
        this.$emit('createGame')
      } catch (error) {
        notifyError(error)
      }
    },
    leaveGameAndGoBack() {
      this.$emit('leaveGame')
    },
    async joinGame(gameId: string | undefined) {
      try {
        this.$emit('joinGame', gameId)
      } catch (error) {
        notifyError(error)
      }
    },
    async rejoinGame(gameId: string | undefined) {
      try {
        this.$emit('rejoinGame', gameId)
      } catch (error) {
        notifyError(error)
      }
    },
    addPlayer(player: { name?: string | null }, index: number) {
      try {
        GameService.addPlayer({ name: player.name ?? '', index })
        this.currentPlayerName = ''
      } catch (error) {
        notifyError(error)
      }
    },
    removePlayer(index: number, name: string | null = null) {
      try {
        GameService.removePlayer(index, name)
      } catch (error) {
        notifyError(error)
      }
    },
    startGame() {
      GameService.startGame()
      this.$emit('startGame')
    },
    isRejoinable(game: GameSummary) {
      return game.players?.some((p) => p.deviceId === GameService.deviceId)
    },
    canToggleSlot(player: Player): boolean {
      return Boolean(
        (player.socketId && player.deviceId === GameService.deviceId) ||
        (!player.socketId && player.name)
      )
    },
  },
}
</script>
