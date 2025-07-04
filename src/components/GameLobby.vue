<template>
  <div class="game-lobby">
    <div
      class="connection-status"
      :class="{ 'is-connected': gameService.isConnected.value }"
    >
      <div class="status-dot"></div>
      <span class="status-text">{{
        gameService.isConnected.value ? 'Подключено' : 'Отключено'
      }}</span>
    </div>
    <div v-if="!currentGame?.id" class="lobby-menu">
      <h2>Каркассон Онлайн</h2>
      <div v-if="!gameService.isConnected.value" class="connection-error">
        <div class="loader-spinner"></div>
        <p>Идет соединение с сервером...</p>
      </div>
      <div v-else-if="isLoadingGames" class="loading-games">
        <div class="loader-spinner"></div>
        <p>Загрузка списка игр...</p>
      </div>
      <div v-else class="lobby-actions">
        <div class="list-header">
          <div class="lobby-actions__filter">
            <PlayersListInputCheckbox
              id="show-ended-games"
              :model-value="Boolean(showEndedGames)"
              @change="showEndedGames = !showEndedGames"
            />
            <label for="show-ended-games">Показать оконченные</label>
          </div>
          <button class="lobby-actions__create" @click="createGame">
            Создать новую игру
          </button>
        </div>
        <div class="join-game">
          <template v-if="computedGamesList.length === 0">
            <div>Нет текущих игр</div>
          </template>
          <template v-else>
            <div
              v-for="game in computedGamesList"
              :key="game.id"
              class="game-item"
            >
              <span> id {{ game.id }} </span>
              <span> Игроков {{ game.players?.length }} </span>
              <span>
                <template v-if="game.gameIsStarted && !game.gameIsEnded">
                  Ход {{ game.moveCounter }}
                </template>
                <template v-else-if="game.gameIsEnded"> Окончена </template>
              </span>
              <span>
                <template v-if="game.gameIsStarted">
                  <span v-for="(value, key, index) in game.scores" :key="key">
                    <template
                      v-if="
                        !game.players[index].socketId &&
                        !game.players[index].deviceId &&
                        game.players[index].name
                      "
                      class="is-ai-player"
                    >
                      AI
                    </template>
                    {{ game.players[index]?.name }} - {{ value
                    }}{{ index !== game.players.length - 1 ? ', ' : '' }}
                  </span>
                </template>
              </span>
              <button
                v-if="!currentGame?.id"
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

    <div v-if="currentGame?.id" class="game-info">
      <div v-if="!gameService.isConnected.value" class="connection-error">
        <div class="loader-spinner"></div>
        <p>Идет соединение с сервером...</p>
      </div>
      <div v-else class="game-header">
        <h3>ID игры: {{ currentGame?.id }}</h3>
        <!--        <div class="game-title">-->
        <!--          <input v-model="currentGame.name" placeholder="Ваше имя" />-->
        <!--        </div>-->
        <div class="players-list">
          <div
            v-for="(player, index) in players"
            :key="player.id"
            class="player-item"
          >
            <PlayersListInputCheckbox
              :style="{ color: player.color }"
              :model-value="Boolean(player.name)"
              :disabled="
                player.socketId && player.deviceId !== gameService.deviceId
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
              :disabled="player.socketId || !player.name"
              :style="{ borderColor: player.name ? player.color : '#ccc' }"
              @input="currentPlayerName = $event.target.value"
            />
            <div v-if="!player.socketId && player.name" class="is-ai-player">
              AI
            </div>
            <button
              v-if="
                (player.socketId && player.deviceId === gameService.deviceId) ||
                (!player.socketId && player.name)
              "
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
        <div class="game-actions">
          <button class="bottom-button" @click="leaveGameAndGoBack">
            Отключиться
          </button>
          <button class="bottom-button" @click="startGame">Начать игру</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import GameService from '@/modules/GameService'
import notificationService from '@/plugins/notification'
import { IGameBoard } from '../../server/src/modules/GameManager'
import PlayersListInputCheckbox from './../components/PlayersListInputCheckbox.vue'

export default {
  name: 'GameLobby',
  components: { PlayersListInputCheckbox },
  props: {
    gameState: {
      type: Object as () => IGameBoard,
      default: () => ({}),
    },
    gamesList: {
      type: Array,
      default: () => [],
    },
    players: {
      type: Array,
      default: () => [],
    },
    currentGame: {
      type: Object,
      default: () => ({}),
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
    computedGamesList() {
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
    async createGame() {
      try {
        this.$emit('createGame')
      } catch (error) {
        notificationService.error(error)
      }
    },
    leaveGameAndGoBack() {
      this.$emit('leaveGame')
    },
    async joinGame(gameId) {
      try {
        this.$emit('joinGame', gameId)
      } catch (error) {
        notificationService.error(error)
      }
    },
    async rejoinGame(gameId) {
      try {
        this.$emit('rejoinGame', gameId)
      } catch (error) {
        notificationService.error(error)
      }
    },
    addPlayer(player, index) {
      try {
        GameService.addPlayer({ name: player.name, index })
        this.currentPlayerName = ''
      } catch (error) {
        notificationService.error(error)
      }
    },
    removePlayer(index, name = null) {
      try {
        GameService.removePlayer(index, name)
      } catch (error) {
        notificationService.error(error)
      }
    },
    startGame() {
      GameService.startGame()
      this.$emit('startGame')
    },
    isRejoinable(game) {
      return game.players?.some((p) => p.deviceId === GameService.deviceId)
    },
  },
}
</script>

<style lang="scss" scoped>
h2 {
  margin-bottom: 1rem;
  text-align: center;
  font-size: 2rem;
  color: #333;
}
.game-lobby {
  z-index: 3000;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 2rem;
  color: #333;

  .lobby-menu {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    background-color: #fff;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

h3 {
  margin-bottom: 1rem;
  text-align: center;
  font-size: 1.5rem;
  color: #333;
}

.players-list {
  width: 500px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin: 1.5rem 0 2rem;

  .player-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 1rem 0 0.5rem;
    border-radius: 8px;
  }

  input {
    padding: 0.5rem 1rem;
    font-size: 1.1rem;
    font-weight: 500;
    color: #333;
    flex-grow: 1;
    outline: none;
    background-color: transparent;
    border-width: 2px;
    border-style: solid;
    border-color: #aeaeae;
    border-radius: 8px;

    &::placeholder {
      color: #aeaeae;
      font-size: 1.1rem;
      font-weight: 500;
    }
  }

  button {
    font-size: 1.1rem;
    font-weight: 500;
    color: #333;
    border-width: 2px;
    border-style: solid;
    border-color: #aeaeae;
    border-radius: 8px;
    background-color: transparent;

    &:hover {
      cursor: pointer;
      background-color: #aeaeae;
    }
  }
}

.is-ai-player {
  font-size: 1rem;
  font-weight: 500;
  color: currentColor;
}

.game-actions {
  display: flex;
  gap: 2rem;
  justify-content: center;
}

.bottom-button {
  /* Основные стили */
  padding: 12px 24px;
  font-size: 16px;
  font-weight: bold;
  color: #333;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.5);

  /* Форма и границы */
  border-radius: 8px;
  border: none;
  outline: none;
  cursor: pointer;
  position: relative;

  /* Текстура камня */
  background: linear-gradient(145deg, #a8a8a8, #8a8a8a);
  box-shadow:
    3px 3px 5px rgba(0, 0, 0, 0.3),
    inset 1px 1px 3px rgba(255, 255, 255, 0.2),
    inset -1px -1px 3px rgba(0, 0, 0, 0.2);

  /* Эффект объема */
  transform: translateY(0);
  transition: all 0.2s ease;

  /* Дополнительные детали для текстуры камня */
  background-image:
    radial-gradient(
      circle at 20% 30%,
      rgba(255, 255, 255, 0.1) 0%,
      transparent 20%
    ),
    radial-gradient(circle at 80% 70%, rgba(0, 0, 0, 0.1) 0%, transparent 20%);

  &:hover {
    background: linear-gradient(145deg, #9a9a9a, #7c7c7c);
    box-shadow:
      4px 4px 6px rgba(0, 0, 0, 0.4),
      inset 1px 1px 3px rgba(255, 255, 255, 0.2),
      inset -1px -1px 3px rgba(0, 0, 0, 0.2);
    transform: translateY(-2px);
    color: #222;
  }

  &:active {
    background: linear-gradient(145deg, #7c7c7c, #6e6e6e);
    box-shadow:
      1px 1px 2px rgba(0, 0, 0, 0.3),
      inset 2px 2px 4px rgba(0, 0, 0, 0.2),
      inset -1px -1px 2px rgba(255, 255, 255, 0.1);
    transform: translateY(1px);
  }
}

.join-game {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 700px;
  overflow-y: scroll;
}

.game-item {
  margin-bottom: 10px;
  background-color: #5a80aa;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 40px;
  transition: all 0.2s ease;

  span {
    display: block;
    white-space: nowrap;
    width: 150px;
    font-size: 1rem;
    font-weight: 500;
    color: #fff;
  }
  button {
    width: 220px;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    background-color: #f5f5f5;
    color: #333;

    &:hover {
      background-color: #e0e0e0;
    }

    &:active {
      transform: translateY(2px);
    }
  }
}

.lobby-actions {
  &__create {
    margin-top: 10px;
    padding: 0.75rem;
    border-radius: 8px;
    border: none;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    background-color: #5a80aa;
    color: #fff;

    &:hover {
      background-color: #4a6a8a;
    }

    &:active {
      transform: translateY(2px);
    }
  }
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  gap: 100px;
  .lobby-actions__filter {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 1rem;
    color: #333;
    font-weight: 500;
  }
}

.game-info {
  margin-top: 2rem;
  border-top: 1px solid #e0e0e0;
  background-color: #f8f9fa;
  padding: 2rem;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &__title {
    margin-bottom: 1rem;
    font-size: 1.2rem;
    color: #333;
    font-weight: 500;
  }
}

.connection-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  p {
    margin: 0;
    color: #666;
    font-size: 1.1rem;
    text-align: center;
  }
}

.loading-games {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  p {
    margin: 0;
    color: #666;
    font-size: 1.1rem;
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

.connection-status {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 3001;

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #ff4444;
    transition: background-color 0.3s ease;
  }

  .status-text {
    font-size: 0.9rem;
    color: #666;
  }

  &.is-connected {
    .status-dot {
      background-color: #44ff44;
    }
  }
}
</style>
