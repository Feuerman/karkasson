<template>
  <div
    class="absolute inset-0 z-[3000] flex h-full w-full flex-col items-center bg-black/50 p-8 text-text"
  >
    <div class="fixed right-4 top-4 z-[3001] flex items-center gap-2">
      <UBadge
        :color="connectionColor"
        variant="subtle"
        class="rounded-full bg-white/90 px-4 py-2 shadow-soft"
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
    <UCard
      v-if="!currentGame?.id"
      class="rounded-lg shadow-card"
      :ui="{
        root: 'rounded-lg',
        body: 'flex flex-col items-center justify-center gap-4 p-8',
      }"
    >
      <h2 class="mb-4 text-center text-[2rem] text-text">Каркассон Онлайн</h2>
      <div
        v-if="!gameService.isConnected.value"
        class="flex flex-col items-center justify-center gap-4 rounded-lg p-8"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="h-10 w-10 animate-spin text-primary"
        />
        <p class="m-0 text-center text-[1.1rem] text-text-muted">
          Идет соединение с сервером...
        </p>
      </div>
      <div
        v-else-if="isLoadingGames"
        class="flex flex-col items-center justify-center gap-4 rounded-lg p-8"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="h-10 w-10 animate-spin text-primary"
        />
        <p class="m-0 text-center text-[1.1rem] text-text-muted">
          Загрузка списка игр...
        </p>
      </div>
      <div v-else class="flex flex-col items-stretch gap-2">
        <div class="mb-6 flex items-center justify-between gap-[100px]">
          <UCheckbox
            label="Показать оконченные"
            :model-value="Boolean(showEndedGames)"
            @update:model-value="showEndedGames = !showEndedGames"
          />
          <UButton class="mt-2.5 px-3 py-3 text-base" @click="createGame">
            Создать новую игру
          </UButton>
        </div>
        <div class="flex h-[700px] flex-col gap-2 overflow-y-scroll">
          <UEmpty
            v-if="computedGamesList.length === 0"
            icon="i-lucide-grid-3x3"
            title="Нет текущих игр"
            description="Создайте новую игру или присоединитесь к существующей"
            class="mx-auto my-auto"
          />
          <template v-else>
            <UCard
              v-for="game in computedGamesList"
              :key="game.id"
              class="mb-2.5 !border-accent !bg-accent text-white transition-all duration-200 hover:!bg-accent-dark active:translate-y-0.5"
              :ui="{
                body: 'flex items-center justify-between gap-10 px-6 py-4',
              }"
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
              <UButton
                v-if="!currentGame?.id"
                color="neutral"
                variant="soft"
                class="w-[220px] text-text"
                @click="
                  isRejoinable(game) ? rejoinGame(game.id) : joinGame(game.id)
                "
              >
                <template v-if="!game.gameIsStarted">Войти</template>
                <template v-else-if="game.gameIsStarted && !game.gameIsEnded"
                  >Продолжить</template
                >
                <template v-else>Загрузить</template>
              </UButton>
            </UCard>
          </template>
        </div>
      </div>
    </UCard>

    <UCard
      v-if="currentGame?.id"
      class="mt-8 border-t border-border bg-surface-soft shadow-soft"
      :ui="{ root: 'rounded-lg', body: 'flex flex-col gap-4 p-8' }"
    >
      <div
        v-if="!gameService.isConnected.value"
        class="flex flex-col items-center justify-center gap-4 rounded-lg p-8"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="h-10 w-10 animate-spin text-primary"
        />
        <p class="m-0 text-center text-[1.1rem] text-text-muted">
          Идет соединение с сервером...
        </p>
      </div>
      <div v-else class="flex flex-col items-center">
        <h3 class="mb-4 text-center text-[1.5rem] text-text">
          ID игры: {{ currentGame?.id }}
        </h3>
        <div class="my-6 mb-8 flex w-[500px] flex-col gap-6">
          <div
            v-for="(player, index) in players"
            :key="player.id"
            class="flex items-center gap-3 rounded-lg py-1.5 pl-2 pr-4"
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
                  'border-2 ' +
                  playerBorderColorClass(player.name ? player.color : null),
              }"
              class="flex-1 rounded-lg bg-transparent text-[1.1rem] font-medium text-text"
              @update:model-value="onPlayerNameInput"
            />
            <div v-if="!player.socketId && player.name" class="text-text">
              AI
            </div>
            <UButton
              v-if="
                (player.socketId && player.deviceId === gameService.deviceId) ||
                (!player.socketId && player.name)
              "
              variant="outline"
              color="neutral"
              :ui="{
                base:
                  'border-2 ' +
                  playerBorderColorClass(player.name ? player.color : null),
              }"
              class="whitespace-nowrap px-5 py-2 text-[1.1rem] font-medium text-text"
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
        <div class="mt-4 flex justify-center gap-6">
          <UButton
            class="btn-stone min-w-[220px] !text-text px-8 py-3.5 text-base font-bold shadow-soft"
            @click="leaveGameAndGoBack"
          >
            Отключиться
          </UButton>
          <UButton
            class="btn-stone min-w-[220px] !text-text px-8 py-3.5 text-base font-bold shadow-soft"
            @click="startGame"
          >
            Начать игру
          </UButton>
        </div>
      </div>
    </UCard>
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
import UCard from '@nuxt/ui/components/Card.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UInput from '@nuxt/ui/components/Input.vue'
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
  components: {
    UBadge,
    UButton,
    UCard,
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
    connectionColor(): 'success' | 'error' {
      return this.gameService.isConnected.value ? 'success' : 'error'
    },
    connectionDotClass(): string {
      return this.gameService.isConnected.value
        ? 'bg-[#44ff44]'
        : 'bg-[#ff4444]'
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
  },
}
</script>
