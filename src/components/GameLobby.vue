<template>
  <div class="game-lobby">
    <div v-if="!isInGame" class="lobby-menu">
      <h2>Каркассон Онлайн</h2>
      <div class="lobby-actions">
        <button @click="createGame">Создать новую игру</button>
        <div class="join-game">
          <div v-for="game in gamesList" :key="game.id">
            <button
              @click="game.isLastGame ? rejoinGame(game.id) : joinGame(game.id)"
            >
              {{ game.isLastGame ? 'Продолжить игру' : 'Присоединиться' }} к
              игре {{ game.id }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="game-info">
      <div class="game-header">
        <h3>ID игры: {{ currentGameId }}</h3>
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
        <button @click="leaveGameAndGoBack">К списку игр</button>
        <button @click="startGame">Начать игру</button>
      </div>
    </div>
  </div>
</template>

<script>
import GameService from '@/modules/GameService'
import notificationService from '@/plugins/notification'

export default {
  name: 'GameLobby',
  data() {
    return {
      gameId: '',
      showNameError: false,
      showGameIdError: false,
      isInGame: false,
      currentGameId: null,
      gameIsStarted: false,
      players: [],
      gamesList: [],
    }
  },
  created() {
    GameService.connect()

    GameService.onGameUpdated((game) => {
      this.players = game.players
      if (game.gameIsStarted && !this.gameIsStarted) {
        this.gameIsStarted = true
        this.$emit('gameStarted', game)
      }
    })

    GameService.socket.on('updateGamesList', (gamesList) => {
      this.updateLocalGamesList(gamesList)
    })

    GameService.socket.on('connect', () => {
      this.getGamesList()
    })

    GameService.onPlayerDisconnected(() => {
      console.log('Player disconnected, resetting lobby state')
    })
  },
  beforeUnmount() {
    console.log('GameLobby component being unmounted')
    // НЕ отключаем сокет при размонтировании компонента
    // GameService.disconnect();
  },
  methods: {
    async createGame() {
      try {
        const game = await GameService.createGame()
        this.isInGame = true
        this.currentGameId = game.id
        this.players = game.players
      } catch (error) {
        notificationService.error(error)
      }
    },
    leaveGameAndGoBack() {
      this.isInGame = false
      this.currentGameId = null
      this.players = []
      this.getGamesList()
    },
    async joinGame(gameId) {
      this.gameId = gameId

      try {
        const game = await GameService.joinGame(this.gameId)
        this.isInGame = true
        this.currentGameId = game.id
        this.players = game.players
      } catch (error) {
        notificationService.error(error)
      }
    },
    async rejoinGame(gameId) {
      try {
        const game = await GameService.rejoinGame(gameId)
        this.isInGame = true
        this.currentGameId = gameId
        this.players = game.players
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
    },
    async getGamesList() {
      try {
        const gamesList = await GameService.getGamesList()

        this.updateLocalGamesList(gamesList)
      } catch (error) {
        notificationService.error(error)
      }
    },
    updateLocalGamesList(gamesList) {
      const savedGameId = localStorage.getItem('lastGameId')

      this.gamesList = gamesList.map((game) => ({
        ...game,
        isLastGame: game.id === savedGameId,
      }))
    },
  },
}
</script>

<style lang="scss" scoped>
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

  &__title {
    color: #2196f3;
    font-size: 2.5rem;
    text-align: center;
    margin-bottom: 2rem;
    font-weight: 600;
  }

  &__players {
    display: grid;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  &__player {
    background-color: #f8f9fa;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.2s ease;

    &--ready {
      border-left: 4px solid #4caf50;
      background-color: #f1f8e9;
    }

    &--waiting {
      border-left: 4px solid #ff9800;
    }
  }

  &__player-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  &__player-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: #e3f2fd;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #2196f3;
    font-weight: 600;
  }

  &__player-name {
    font-size: 1.1rem;
    font-weight: 500;
    color: #333;
  }

  &__player-status {
    font-size: 0.9rem;
    color: #666;
  }

  &__controls {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 2rem;
  }

  &__button {
    padding: 0.75rem 2rem;
    border-radius: 8px;
    border: none;
    font-size: 1.1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    &--primary {
      background-color: #2196f3;
      color: white;

      &:hover {
        background-color: #1976d2;
        transform: translateY(-2px);
      }

      &:active {
        transform: translateY(0);
      }
    }

    &--secondary {
      background-color: #f5f5f5;
      color: #333;

      &:hover {
        background-color: #e0e0e0;
      }
    }

    &:disabled {
      background-color: #bdbdbd;
      cursor: not-allowed;
      transform: none;
    }
  }

  &__settings {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid #e0e0e0;
  }

  &__setting-group {
    margin-bottom: 1.5rem;
  }

  &__setting-label {
    display: block;
    margin-bottom: 0.5rem;
    color: #333;
    font-weight: 500;
  }

  &__setting-input {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 1rem;
    transition: border-color 0.2s ease;

    &:focus {
      border-color: #2196f3;
      outline: none;
    }
  }

  &__setting-select {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 1rem;
    background-color: white;
    cursor: pointer;
    transition: border-color 0.2s ease;

    &:focus {
      border-color: #2196f3;
      outline: none;
    }
  }
}
</style>
