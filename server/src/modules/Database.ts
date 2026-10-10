import { initializeApp } from 'firebase/app'
import {
  getDatabase,
  ref,
  set,
  get,
  remove,
  type Database,
} from 'firebase/database'
import { getFirebaseConfig, type FirebaseConfig } from '../config'
import type { IGameBoard } from './GameManager'
import { deserializeGameState, serializeGameState } from './gameSave'
import { SaveErrors } from './errors'

/** Абстракция хранилища игр, чтобы сервер можно было тестировать без Firebase */
export interface IGameDatabase {
  saveGame(gameId: string, gameState: IGameBoard): Promise<void>
  getGame(gameId: string): Promise<IGameBoard | null>
  getAllGames(): Promise<IGameBoard[]>
  saveAllGames(games: IGameBoard[]): Promise<void>
  deleteGame(gameId: string): Promise<void>
}

export class InMemoryGameDatabase implements IGameDatabase {
  private games = new Map<string, string>()

  async saveGame(gameId: string, gameState: IGameBoard): Promise<void> {
    if (gameState.id !== gameId) {
      throw new Error(SaveErrors.StorageKeyMismatch)
    }
    gameState.lastUpdate = Date.now()
    this.games.set(gameId, serializeGameState(gameState))
  }

  async getGame(gameId: string): Promise<IGameBoard | null> {
    const savedGame = this.games.get(gameId)
    return savedGame ? deserializeGameState(savedGame) : null
  }

  async getAllGames(): Promise<IGameBoard[]> {
    return Array.from(this.games.values(), deserializeGameState)
  }

  async saveAllGames(games: IGameBoard[]): Promise<void> {
    this.games.clear()
    for (const game of games) {
      if (game.id) await this.saveGame(game.id, game)
    }
  }

  async deleteGame(gameId: string): Promise<void> {
    this.games.delete(gameId)
  }
}

class GameDatabase implements IGameDatabase {
  private firebaseDatabase: Database

  constructor(firebaseConfig: FirebaseConfig) {
    const app = initializeApp(firebaseConfig)
    this.firebaseDatabase = getDatabase(app)
  }

  // Сохранение состояния игры
  async saveGame(gameId: string, gameState: IGameBoard): Promise<void> {
    if (gameState.id !== gameId) {
      throw new Error(SaveErrors.StorageKeyMismatch)
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

let firebaseGameDatabase: GameDatabase | undefined

export function createGameDatabase(
  environment: NodeJS.ProcessEnv = process.env
): IGameDatabase {
  if (environment.NODE_ENV !== 'production') {
    return new InMemoryGameDatabase()
  }
  return (firebaseGameDatabase ??= new GameDatabase(
    getFirebaseConfig(environment)
  ))
}

export const gameDatabase = createGameDatabase()
export type { GameDatabase }
