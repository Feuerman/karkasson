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
    gameState.lastUpdate = Date.now()
    await set(
      ref(this.firebaseDatabase, `games/${gameId}`),
      JSON.stringify(gameState)
    )
  }

  // Получение состояния игры
  async getGame(gameId: string): Promise<IGameBoard | null> {
    const snapshot = await get(ref(this.firebaseDatabase, `games/${gameId}`))
    if (!snapshot.exists()) {
      return null
    }
    return parseGame(snapshot.val())
  }

  // Получение всех сохраненных игр
  async getAllGames(): Promise<IGameBoard[]> {
    const snapshot = await get(ref(this.firebaseDatabase, 'games'))
    if (!snapshot.exists()) {
      return []
    }
    return Object.values(snapshot.val() as Record<string, unknown>).map(
      parseGame
    )
  }

  async saveAllGames(games: IGameBoard[]): Promise<void> {
    await set(ref(this.firebaseDatabase, 'games/'), games)
  }

  // Удаление игры
  async deleteGame(gameId: string): Promise<void> {
    await remove(ref(this.firebaseDatabase, `games/${gameId}`))
  }
}

export const gameDatabase = new GameDatabase()
export type { GameDatabase }
