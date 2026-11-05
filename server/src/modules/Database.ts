import { initializeApp } from 'firebase/app'
import {
  inMemoryPersistence,
  initializeAuth,
  signInWithCustomToken,
  type Auth,
} from 'firebase/auth'
import {
  getDatabase,
  ref,
  set,
  get,
  remove,
  type Database,
} from 'firebase/database'
import {
  getFirebaseConfig,
  type FirebaseConfig,
  type FirebaseServiceAccount,
} from '../config'
import type { IGameState } from './gameState'
import { deserializeGameState, readGameSummary } from './gameSave'
import { createServerCustomToken } from './firebaseAuth'

/** Строка сохранения в том виде, в каком она лежит в хранилище. */
export type GameSavePayload = string

/** Запись сохранения до разбора: строка JSON либо уже разобранный объект. */
export type RawGameSave = unknown

/**
 * Сводка партии для списка лобби: заголовок без разбора остального состояния.
 */
export interface GameSummaryRecord {
  id: string
  roomCode?: string
  players?: IGameState['players']
  currentPlayer?: IGameState['currentPlayer']
  gameIsEnded?: boolean
  moveCounter?: number
  scores?: IGameState['scores']
  gameIsStarted?: boolean
  lastUpdate?: number
  rules?: IGameState['rules']
  finalScoringEnabled?: boolean
}

/**
 * Абстракция хранилища игр, чтобы сервер можно было тестировать без Firebase.
 *
 * База не знает формата сохранения: она читает и пишет строки. Сборка и разбор — дело
 * `gameSave.ts`. Так партия записывается ровно один раз, а список лобби
 * читается без проверки и миграции всех сохранений целиком.
 */
export interface IGameDatabase {
  /** Сохраняет уже сериализованное состояние партии. */
  saveGame(gameId: string, serializedState: GameSavePayload): Promise<void>
  getGame(gameId: string): Promise<IGameState | null>
  /** Все сохранения без разбора: разбор делает вызывающий, чтобы видеть отказы. */
  getAllGameSaves(): Promise<RawGameSave[]>
  /** Заголовки партий для списка лобби без полного разбора сохранений. */
  getGameSummaries(): Promise<GameSummaryRecord[]>
  deleteGame(gameId: string): Promise<void>
}

export class InMemoryGameDatabase implements IGameDatabase {
  private games = new Map<string, GameSavePayload>()

  async saveGame(
    gameId: string,
    serializedState: GameSavePayload
  ): Promise<void> {
    this.games.set(gameId, serializedState)
  }

  async getGame(gameId: string): Promise<IGameState | null> {
    const savedGame = this.games.get(gameId)
    return savedGame ? deserializeGameState(savedGame) : null
  }

  async getAllGameSaves(): Promise<RawGameSave[]> {
    return [...this.games.values()]
  }

  async getGameSummaries(): Promise<GameSummaryRecord[]> {
    const summaries: GameSummaryRecord[] = []
    for (const payload of this.games.values()) {
      const summary = readGameSummary(payload)
      if (summary) summaries.push(summary)
    }
    return summaries
  }

  async deleteGame(gameId: string): Promise<void> {
    this.games.delete(gameId)
  }
}

class GameDatabase implements IGameDatabase {
  private firebaseDatabase: Database
  private auth: Auth
  private serviceAccount: FirebaseServiceAccount
  private authPromise: Promise<void> | undefined

  constructor(firebaseConfig: FirebaseConfig) {
    const app = initializeApp({
      apiKey: firebaseConfig.apiKey,
      databaseURL: firebaseConfig.databaseURL,
      projectId: firebaseConfig.serviceAccount.projectId,
    })
    this.auth = initializeAuth(app, { persistence: inMemoryPersistence })
    this.firebaseDatabase = getDatabase(app)
    this.serviceAccount = firebaseConfig.serviceAccount
  }

  /**
   * Вход серверным сервисным аккаунтом. Правила Realtime Database закрыты для
   * клиентов, поэтому без этого шага ни чтение, ни запись не пройдут.
   */
  private ensureAuthenticated(): Promise<void> {
    this.authPromise ??= signInWithCustomToken(
      this.auth,
      createServerCustomToken(this.serviceAccount)
    ).then(
      () => undefined,
      (error: unknown) => {
        this.authPromise = undefined
        throw error
      }
    )
    return this.authPromise
  }

  async saveGame(
    gameId: string,
    serializedState: GameSavePayload
  ): Promise<void> {
    await this.ensureAuthenticated()
    await set(ref(this.firebaseDatabase, `games/${gameId}`), serializedState)
  }

  async getGame(gameId: string): Promise<IGameState | null> {
    await this.ensureAuthenticated()
    const snapshot = await get(ref(this.firebaseDatabase, `games/${gameId}`))
    if (!snapshot.exists()) {
      return null
    }
    return deserializeGameState(snapshot.val())
  }

  async getAllGameSaves(): Promise<RawGameSave[]> {
    await this.ensureAuthenticated()
    const snapshot = await get(ref(this.firebaseDatabase, 'games'))
    if (!snapshot.exists()) {
      return []
    }
    return Object.values(snapshot.val() as Record<string, unknown>)
  }

  async getGameSummaries(): Promise<GameSummaryRecord[]> {
    const saves = await this.getAllGameSaves()
    const summaries: GameSummaryRecord[] = []
    for (const save of saves) {
      const summary = readGameSummary(save)
      if (summary) summaries.push(summary)
    }
    return summaries
  }

  async deleteGame(gameId: string): Promise<void> {
    await this.ensureAuthenticated()
    await remove(ref(this.firebaseDatabase, `games/${gameId}`))
  }
}

let firebaseGameDatabase: GameDatabase | undefined

export function createProductionGameDatabase(
  environment: NodeJS.ProcessEnv = process.env
): IGameDatabase {
  return (firebaseGameDatabase ??= new GameDatabase(
    getFirebaseConfig(environment)
  ))
}
