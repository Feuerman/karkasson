<template>
  <div class="game-lobby">
    <div v-if="!currentGame?.id" class="lobby-menu">
      <h2>Каркассон Онлайн</h2>
      <div class="lobby-actions">
        <button class="lobby-actions__create" @click="createGame">Создать новую игру</button>
        <div class="join-game">
          <div v-for="game in gamesList" :key="game.id" class="game-item">
            <span>
              id {{ game.id }}
            </span>
            <span>
              Игроков {{ game.players?.length }}
            </span>
            <span>
              <template v-if="game.gameIsStarted && !game.gameIsEnded">
                Ход {{ game.moveCounter }}
              </template>
              <template v-else-if="game.gameIsEnded">
                Окончена
              </template>
            </span>
            <span>
              <template v-if="game.gameIsStarted">
                <span v-for="(value, key, index) in game.scores" :key="key">
                  {{ game.players[index]?.name }} - {{ value }}{{ index !== game.players.length - 1 ? ', ' : '' }}
                </span>
              </template>
            </span>
            <button
              v-if="!currentGame?.id"
              @click="isRejoinable(game) ? rejoinGame(game.id) : joinGame(game.id)"
            >
              <template v-if="!game.gameIsStarted">Войти</template>
              <template v-else-if="game.gameIsStarted && !game.gameIsEnded">Продолжить</template>
              <template v-else>Загрузить</template>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="currentGame?.id" class="game-info">
      <div class="game-header">
        <h3>ID игры: {{ currentGame?.id }}</h3>
        <div class="players-list">
          <div
            v-for="(player, index) in players"
            :key="player.id"
            class="player-item"
            :style="{ borderColor: player.color }"
          >
            <input
              v-model="player.name"
              placeholder="Ваше имя"
              :disabled="player.socketId"
            />
            <button v-if="!player.socketId" @click="addPlayer(player, index)">
              +
            </button>
          </div>
        </div>
        <button class="bottom-button" @click="leaveGameAndGoBack">Отключиться</button>
        <button class="bottom-button" @click="startGame">Начать игру</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import GameService from '@/modules/GameService'
import notificationService from '@/plugins/notification'
import { IGameBoard } from '../../server/src/modules/GameManager'

export default {
  name: 'GameLobby',
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
    }
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
    }
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

.players-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  .player-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 2px solid #333;
    padding: 0.5rem;
    border-radius: 8px;
  }

  input {
    border: none;
    font-size: 1.1rem;
    font-weight: 500;
    color: #333;
    flex-grow: 1;
  }

  button {
    border: none;
    background-color: transparent;
    font-size: 1.1rem;
    font-weight: 500;
    color: #333;
    cursor: pointer;

    &:hover {
      color: #2196f3;
    }

    &:active {
      transform: translateY(2px);
    }
  }
}

.bottom-button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: none;
  font-size: 1.1rem;
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

.join-game {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 700px;
  overflow-y: scroll;
}

.game-item {
  margin-bottom: 10px;
  background-color: #89a1c5;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 40px;
  transition: all 0.2s ease;

span {
  display: block;
  width: 150px;
  font-size: 1.4rem;
  font-weight: 500;
  color: #fff;
}
  button {
    width: 220px;
    padding: 0.75rem 2rem;
    border-radius: 8px;
    border: none;
    font-size: 1.1rem;
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
    margin-bottom: 2rem;
    padding:  1.2rem 2rem;
    border-radius: 8px;
    border: none;
    font-size: 1.4rem;
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

.game-info {
  margin-top: 2rem;
  border-top: 1px solid #e0e0e0;
  background-color: #f8f9fa;
  padding: 1rem 1.5rem;
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
</style>
