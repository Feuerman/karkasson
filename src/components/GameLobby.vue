<template>
  <div
    class="absolute inset-0 z-[3000] flex h-full w-full flex-col items-center bg-black/50 p-8 text-text"
  >
    <div
      class="fixed right-4 top-4 z-[3001] flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow-soft"
    >
      <div
        class="h-2.5 w-2.5 rounded-full bg-[#ff4444] transition-colors duration-300"
        :class="gameService.isConnected.value ? 'bg-[#44ff44]' : ''"
      ></div>
      <span class="text-sm text-text-muted">{{
        gameService.isConnected.value ? 'Подключено' : 'Отключено'
      }}</span>
    </div>
    <div
      v-if="!currentGame?.id"
      class="flex flex-col items-center justify-center gap-4 rounded-lg bg-surface p-8 shadow-card"
    >
      <h2 class="mb-4 text-center text-[2rem] text-text">Каркассон Онлайн</h2>
      <div
        v-if="!gameService.isConnected.value"
        class="flex flex-col items-center justify-center gap-4 rounded-lg bg-white/90 p-8 shadow-card"
      >
        <div
          class="h-10 w-10 animate-spin rounded-full border-4 border-track border-t-accent"
        ></div>
        <p class="m-0 text-center text-[1.1rem] text-text-muted">
          Идет соединение с сервером...
        </p>
      </div>
      <div
        v-else-if="isLoadingGames"
        class="flex flex-col items-center justify-center gap-4 rounded-lg bg-white/90 p-8 shadow-card"
      >
        <div
          class="h-10 w-10 animate-spin rounded-full border-4 border-track border-t-accent"
        ></div>
        <p class="m-0 text-center text-[1.1rem] text-text-muted">
          Загрузка списка игр...
        </p>
      </div>
      <div v-else class="lobby-actions">
        <div class="mb-6 flex items-center justify-between gap-[100px]">
          <div
            class="flex items-center gap-0.5 text-base font-medium text-text"
          >
            <PlayersListInputCheckbox
              id="show-ended-games"
              :model-value="Boolean(showEndedGames)"
              @change="showEndedGames = !showEndedGames"
            />
            <label for="show-ended-games">Показать оконченные</label>
          </div>
          <button
            class="mt-2.5 cursor-pointer rounded-lg border-0 bg-accent px-3 py-3 text-base font-medium text-white transition-all duration-200 hover:bg-accent-dark active:translate-y-0.5"
            @click="createGame"
          >
            Создать новую игру
          </button>
        </div>
        <div class="flex h-[700px] flex-col gap-2 overflow-y-scroll">
          <template v-if="computedGamesList.length === 0">
            <div>Нет текущих игр</div>
          </template>
          <template v-else>
            <div
              v-for="game in computedGamesList"
              :key="game.id"
              class="mb-2.5 flex items-center justify-between gap-10 rounded-lg bg-accent px-6 py-4 transition-all duration-200"
            >
              <span
                class="block w-[150px] whitespace-nowrap text-base font-medium text-white"
              >
                id {{ game.id }}
              </span>
              <span
                class="block w-[150px] whitespace-nowrap text-base font-medium text-white"
              >
                Игроков {{ game.players?.length }}
              </span>
              <span
                class="block w-[150px] whitespace-nowrap text-base font-medium text-white"
              >
                <template v-if="game.gameIsStarted && !game.gameIsEnded">
                  Ход {{ game.moveCounter }}
                </template>
                <template v-else-if="game.gameIsEnded"> Окончена </template>
              </span>
              <div
                class="flex w-[220px] flex-col gap-0.5 text-base font-medium text-white"
              >
                <template v-if="game.gameIsStarted">
                  <span v-for="(value, key, index) in game.scores" :key="key">
                    <template
                      v-if="
                        !game.players[index].socketId &&
                        !game.players[index].deviceId &&
                        game.players[index].name
                      "
                    >
                      AI
                    </template>
                    {{ game.players[index]?.name }} - {{ value }}
                  </span>
                </template>
              </div>
              <button
                v-if="!currentGame?.id"
                class="w-[220px] cursor-pointer rounded-lg border-0 bg-surface-muted px-4 py-2 text-base font-medium text-text transition-all duration-200 hover:bg-border active:translate-y-0.5"
                @click="
                  isRejoinable(game) ? rejoinGame(game.id) : joinGame(game.id)
                "
              >
                <template v-if="!game.gameIsStarted">Войти</template>
                <template v-else-if="game.gameIsStarted && !game.gameIsEnded"
                  >Продолжить</template
                >
                <template v-else>Загрузить</template>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div
      v-if="currentGame?.id"
      class="mt-8 flex flex-col gap-4 rounded-lg border-t border-border bg-surface-soft p-8 shadow-soft"
    >
      <div
        v-if="!gameService.isConnected.value"
        class="flex flex-col items-center justify-center gap-4 rounded-lg bg-white/90 p-8 shadow-card"
      >
        <div
          class="h-10 w-10 animate-spin rounded-full border-4 border-track border-t-accent"
        ></div>
        <p class="m-0 text-center text-[1.1rem] text-text-muted">
          Идет соединение с сервером...
        </p>
      </div>
      <div v-else class="game-header">
        <h3 class="mb-4 text-center text-[1.5rem] text-text">
          ID игры: {{ currentGame?.id }}
        </h3>
        <!--        <div class="game-title">-->
        <!--          <input v-model="currentGame.name" placeholder="Ваше имя" />-->
        <!--        </div>-->
        <div class="my-6 mb-8 flex w-[500px] flex-col gap-6">
          <div
            v-for="(player, index) in players"
            :key="player.id"
            class="flex items-center gap-3 rounded-lg py-1.5 pl-2 pr-4"
          >
            <PlayersListInputCheckbox
              :class="playerTextColorClass(player.color)"
              :model-value="Boolean(player.name)"
              :disabled="
                Boolean(
                  player.socketId && player.deviceId !== gameService.deviceId
                )
              "
              @change="
                player.socketId || player.name
                  ? removePlayer(index)
                  : addPlayer(player, index)
              "
            />

            <input
              :value="player.name"
              :placeholder="`Игрок ${index + 1}`"
              :disabled="Boolean(player.socketId || !player.name)"
              :class="playerBorderColorClass(player.name ? player.color : null)"
              class="flex-grow rounded-lg border-2 border-solid bg-transparent px-4 py-2 text-[1.1rem] font-medium text-text outline-none placeholder:text-border-strong disabled:cursor-not-allowed"
              @input="onPlayerNameInput"
            />
            <div
              v-if="!player.socketId && player.name"
              class="text-base font-medium text-current"
            >
              AI
            </div>
            <button
              v-if="
                (player.socketId && player.deviceId === gameService.deviceId) ||
                (!player.socketId && player.name)
              "
              :class="playerBorderColorClass(player.name ? player.color : null)"
              class="cursor-pointer whitespace-nowrap rounded-lg border-2 border-solid bg-transparent px-5 py-2 text-[1.1rem] font-medium text-text transition-colors duration-200 hover:bg-border-strong/20 active:translate-y-0.5"
              @click="
                player.socketId
                  ? removePlayer(index, player.name)
                  : addPlayer({ name: currentPlayerName || player.name }, index)
              "
            >
              {{ !player.socketId ? 'Занять' : 'Освободить' }}
            </button>
          </div>
        </div>
        <div class="mt-4 flex justify-center gap-6">
          <button
            class="btn-stone min-w-[220px] rounded-xl px-8 py-3.5 text-base font-bold text-text shadow-soft transition-all duration-200 hover:-translate-y-1 hover:text-[#222] hover:shadow-card active:translate-y-0.5"
            @click="leaveGameAndGoBack"
          >
            Отключиться
          </button>
          <button
            class="btn-stone min-w-[220px] rounded-xl px-8 py-3.5 text-base font-bold text-text shadow-soft transition-all duration-200 hover:-translate-y-1 hover:text-[#222] hover:shadow-card active:translate-y-0.5"
            @click="startGame"
          >
            Начать игру
          </button>
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
import PlayersListInputCheckbox from './../components/PlayersListInputCheckbox.vue'
import { playerBorderColorClass, playerTextColorClass } from '@/utils/colors'

const notifyError = (error: unknown) => {
  if (error instanceof Error) {
    notificationService.error(error.message)
  } else {
    notificationService.error(String(error))
  }
}

export default {
  name: 'GameLobby',
  components: { PlayersListInputCheckbox },
  props: {
    gameState: {
      type: Object as () => IGameBoard,
      default: () => ({}),
    },
    gamesList: {
      type: Array as () => GameSummary[],
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
    computedGamesList(): GameSummary[] {
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
    onPlayerNameInput(event: Event) {
      this.currentPlayerName = (event.target as HTMLInputElement).value
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
  },
}
</script>
