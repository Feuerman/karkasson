import { initializeApp } from 'firebase/app'
import {
  getDatabase,
  ref,
  set,
  get,
  remove,
  type Database,
} from 'firebase/database'
import { firebaseConfig } from '../config'
import type { IGameBoard } from './GameManager'
import { deserializeGameState, serializeGameState } from './gameSave'

/** Абстракция хранилища игр, чтобы сервер можно было тестировать без Firebase */
export interface IGameDatabase {
  saveGame(gameId: string, gameState: IGameBoard): Promise<void>
  getGame(gameId: string): Promise<IGameBoard | null>
  getAllGames(): Promise<IGameBoard[]>
  saveAllGames(games: IGameBoard[]): Promise<void>
  deleteGame(gameId: string): Promise<void>
}

class GameDatabase implements IGameDatabase {
  private firebaseDatabase: Database

  constructor() {
    const app = initializeApp(firebaseConfig)
    this.firebaseDatabase = getDatabase(app)
  }

  // Сохранение состояния игры
  async saveGame(gameId: string, gameState: IGameBoard): Promise<void> {
    if (gameState.id !== gameId) {
      throw new Error('Game id does not match its storage key')
    }
    gameState.lastUpdate = Date.now()
    await set(
      ref(this.firebaseDatabase, `games/${gameId}`),
      serializeGameState(gameState)
    )
  }

  // Получение состояния игры
  async getGame(gameId: string): Promise<IGameBoard | null> {
    const snapshot = await get(ref(this.firebaseDatabase, `games/${gameId}`))
    if (!snapshot.exists()) {
      return null
    }
    return deserializeGameState(snapshot.val())
  }

  // Получение всех сохраненных игр
  async getAllGames(): Promise<IGameBoard[]> {
    const snapshot = await get(ref(this.firebaseDatabase, 'games'))
    if (!snapshot.exists()) {
      return []
    }
    const savedGames: IGameBoard[] = []
    for (const [gameId, rawGame] of Object.entries(
      snapshot.val() as Record<string, unknown>
    )) {
      try {
        savedGames.push(deserializeGameState(rawGame))
      } catch (error) {
        console.error(`Ignoring invalid saved game "${gameId}":`, error)
      }
    }
    return savedGames
  }

  async saveAllGames(games: IGameBoard[]): Promise<void> {
    const saves = games.reduce<Record<string, string>>((acc, game) => {
      if (!game.id) return acc
      acc[game.id] = serializeGameState(game)
      return acc
    }, {})
    await set(ref(this.firebaseDatabase, 'games/'), saves)
  }

  // Удаление игры
  async deleteGame(gameId: string): Promise<void> {
    await remove(ref(this.firebaseDatabase, `games/${gameId}`))
  }
}

export const gameDatabase = new GameDatabase()
export type { GameDatabase }
