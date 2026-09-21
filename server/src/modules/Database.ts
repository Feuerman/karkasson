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

function parseGame(raw: unknown): IGameBoard {
  return typeof raw === 'string'
    ? (JSON.parse(raw) as IGameBoard)
    : (raw as IGameBoard)
}

class GameDatabase {
  private firebaseDatabase: Database

  constructor() {
    const app = initializeApp(firebaseConfig)
    this.firebaseDatabase = getDatabase(app)
  }

  // Сохранение состояния игры
  async saveGame(gameId: string, gameState: IGameBoard): Promise<void> {
    gameState.lastUpdate = Date.now()
    try {
      await set(
        ref(this.firebaseDatabase, `games/${gameId}`),
        JSON.stringify(gameState)
      )
    } catch (error) {
      console.error('Error saving to Firebase:', error)
    }
  }

  // Получение состояния игры
  async getGame(gameId: string): Promise<IGameBoard | null> {
    try {
      const snapshot = await get(ref(this.firebaseDatabase, `games/${gameId}`))
      if (!snapshot.exists()) {
        return null
      }
      return parseGame(snapshot.val())
    } catch (error) {
      console.error('Error reading from Firebase:', error)
      return null
    }
  }

  // Получение всех сохраненных игр
  async getAllGames(): Promise<IGameBoard[]> {
    try {
      const snapshot = await get(ref(this.firebaseDatabase, 'games'))
      if (!snapshot.exists()) {
        return []
      }
      return Object.values(snapshot.val() as Record<string, unknown>).map(
        parseGame
      )
    } catch (error) {
      console.error('Error reading all games from Firebase:', error)
      return []
    }
  }

  async saveAllGames(games: IGameBoard[]): Promise<void> {
    try {
      await set(ref(this.firebaseDatabase, 'games/'), games)
    } catch (error) {
      console.error('Error saving to Firebase:', error)
    }
  }

  // Удаление игры
  async deleteGame(gameId: string): Promise<void> {
    try {
      await remove(ref(this.firebaseDatabase, `games/${gameId}`))
    } catch (error) {
      console.error('Error deleting from Firebase:', error)
    }
  }
}

export const gameDatabase = new GameDatabase()
export type { GameDatabase }
