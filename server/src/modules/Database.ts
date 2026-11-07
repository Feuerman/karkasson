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
  update,
  runTransaction,
  type Database,
} from 'firebase/database'

import {
  getFirebaseConfig,
  FIREBASE_OPERATION_ATTEMPTS,
  FIREBASE_OPERATION_TIMEOUT_MS,
  FIREBASE_RETRY_BASE_DELAY_MS,
  INSTANCE_LOCK_STALE_MS,
  type FirebaseConfig,
  type FirebaseServiceAccount,
} from '../config'
import type { IGameState } from './gameState'
import { deserializeGameState, readGameSummary } from './gameSave'
import { createServerCustomToken } from './firebaseAuth'
import { runDatabaseOperation } from './databaseRetry'

/** Строка сохранения в том виде, в каком она лежит в хранилище. */
export type GameSavePayload = string

/** Запись сохранения до разбора: строка JSON либо уже разобранный объект. */
export type RawGameSave = unknown

/**
 * Запись блокировки инстанса в хранилище. В каждый момент времени актуальна
 * не более одной записи: владелец обновляет heartbeat, а второй процесс не
 * может стартовать, пока блокировка не устарела.
 */
export interface InstanceLockRecord {
  /** Уникальный идентификатор инстанса (процесса сервера). */
  instanceId: string
  /** Время запуска инстанса. */
  startedAt: number
  /** Время последнего обновления heartbeat. */
  heartbeatAt: number
  /** PID процесса для диагностики в журналах. */
  pid: number
}

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
export interface GameSummariesResult {
  summaries: GameSummaryRecord[]
  /**
   * Сколько сохранений не удалось превратить в сводку. Для Firebase это
   * значение равно нулю: индекс пишется вместе с сохранением и нечитаемых
   * записей в нём нет.
   */
  unreadable: number
}

export interface IGameDatabase {
  /**
   * Сохраняет состояние партии вместе с заголовком для списка лобби.
   *
   * Сводка передаётся отдельно, потому что формат сохранения знает сервис,
   * а база хранит строки и индекс. Запись индекса не должна требовать разбора
   * всего узла игр.
   */
  saveGame(
    gameId: string,
    serializedState: GameSavePayload,
    summary?: GameSummaryRecord
  ): Promise<void>
  /** Записывает только заголовки: используется миграцией старого хранилища. */
  saveGameSummaries(summaries: GameSummaryRecord[]): Promise<void>
  getGame(gameId: string): Promise<IGameState | null>
  /** Все сохранения без разбора: разбор делает вызывающий, чтобы видеть отказы. */
  getAllGameSaves(): Promise<RawGameSave[]>
  /** Заголовки партий для списка лобби без полного разбора сохранений. */
  getGameSummaries(): Promise<GameSummariesResult>
  deleteGame(gameId: string): Promise<void>

  // ----------------------------------------------------------- instance lock

  /** Текущая запись блокировки инстанса или `null`, если её нет. */
  getInstanceLock(): Promise<InstanceLockRecord | null>
  /**
   * Забирает блокировку инстанса, если её нет или она устарела.
   * `staleMs` — порог устаревания существующей блокировки (по умолчанию
   * `INSTANCE_LOCK_STALE_MS`). Возвращает `true`, если блокировка передана
   * этому инстансу.
   */
  acquireInstanceLock(
    record: InstanceLockRecord,
    staleMs?: number
  ): Promise<boolean>
  /**
   * Обновляет heartbeat блокировки. Возвращает `true`, только если
   * блокировка всё ещё принадлежит инстансу с таким `instanceId`.
   */
  renewInstanceLockHeartbeat(instanceId: string): Promise<boolean>
  /** Освобождает блокировку, только если она принадлежит инстансу. */
  releaseInstanceLock(instanceId: string): Promise<void>
}

export class InMemoryGameDatabase implements IGameDatabase {
  private games = new Map<string, GameSavePayload>()
  private instanceLock: InstanceLockRecord | null = null

  async saveGame(
    gameId: string,
    serializedState: GameSavePayload,
    _summary?: GameSummaryRecord
  ): Promise<void> {
    this.games.set(gameId, serializedState)
  }

  async saveGameSummaries(_summaries: GameSummaryRecord[]): Promise<void> {
    // In-memory хранилище выводит сводки из самих сохранений: отдельный
    // индекс здесь не нужен и не может разойтись с данными.
  }

  async getGame(gameId: string): Promise<IGameState | null> {
    const savedGame = this.games.get(gameId)
    return savedGame ? deserializeGameState(savedGame) : null
  }

  async getAllGameSaves(): Promise<RawGameSave[]> {
    return [...this.games.values()]
  }

  async getGameSummaries(): Promise<GameSummariesResult> {
    const summaries: GameSummaryRecord[] = []
    let unreadable = 0
    for (const payload of this.games.values()) {
      const summary = readGameSummary(payload)
      if (summary) summaries.push(summary)
      else unreadable += 1
    }
    return { summaries, unreadable }
  }

  async deleteGame(gameId: string): Promise<void> {
    this.games.delete(gameId)
  }

  // ----------------------------------------------------------- instance lock

  async getInstanceLock(): Promise<InstanceLockRecord | null> {
    return this.instanceLock
  }

  async acquireInstanceLock(
    record: InstanceLockRecord,
    staleMs: number = INSTANCE_LOCK_STALE_MS
  ): Promise<boolean> {
    const current = this.instanceLock
    if (current && !isStaleInstanceLock(current, staleMs)) return false
    this.instanceLock = record
    return true
  }

  async renewInstanceLockHeartbeat(instanceId: string): Promise<boolean> {
    if (!this.instanceLock || this.instanceLock.instanceId !== instanceId) {
      return false
    }
    this.instanceLock = {
      ...this.instanceLock,
      heartbeatAt: Date.now(),
    }
    return true
  }

  async releaseInstanceLock(instanceId: string): Promise<void> {
    if (this.instanceLock?.instanceId === instanceId) {
      this.instanceLock = null
    }
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

  /** Повторяет операцию с таймаутом и не повторяет отказы прав и данных. */
  private run<T>(operation: () => Promise<T>): Promise<T> {
    return runDatabaseOperation(operation, {
      attempts: FIREBASE_OPERATION_ATTEMPTS,
      timeoutMs: FIREBASE_OPERATION_TIMEOUT_MS,
      baseDelayMs: FIREBASE_RETRY_BASE_DELAY_MS,
    })
  }

  async saveGame(
    gameId: string,
    serializedState: GameSavePayload,
    summary?: GameSummaryRecord
  ): Promise<void> {
    await this.run(() => this.ensureAuthenticated())
    if (!summary) {
      await this.run(() =>
        set(ref(this.firebaseDatabase, `games/${gameId}`), serializedState)
      )
      return
    }

    // Состояние и заголовок пишутся одной операцией: список лобби не должен
    // на время показывать устаревший заголовок или терять партию.
    await this.run(() =>
      update(ref(this.firebaseDatabase), {
        [`games/${gameId}`]: serializedState,
        [`gameSummaries/${gameId}`]: summary,
      })
    )
  }

  async saveGameSummaries(summaries: GameSummaryRecord[]): Promise<void> {
    if (summaries.length === 0) return
    await this.run(() => this.ensureAuthenticated())
    const updates: Record<string, GameSummaryRecord> = {}
    for (const summary of summaries) {
      updates[`gameSummaries/${summary.id}`] = summary
    }
    await this.run(() => update(ref(this.firebaseDatabase), updates))
  }

  async getGame(gameId: string): Promise<IGameState | null> {
    await this.run(() => this.ensureAuthenticated())
    const snapshot = await this.run(() =>
      get(ref(this.firebaseDatabase, `games/${gameId}`))
    )
    if (!snapshot.exists()) {
      return null
    }
    return deserializeGameState(snapshot.val())
  }

  async getAllGameSaves(): Promise<RawGameSave[]> {
    await this.run(() => this.ensureAuthenticated())
    const snapshot = await this.run(() =>
      get(ref(this.firebaseDatabase, 'games'))
    )
    if (!snapshot.exists()) {
      return []
    }
    return Object.values(snapshot.val() as Record<string, unknown>)
  }

  async getGameSummaries(): Promise<GameSummariesResult> {
    await this.run(() => this.ensureAuthenticated())
    const snapshot = await this.run(() =>
      get(ref(this.firebaseDatabase, 'gameSummaries'))
    )
    if (!snapshot.exists()) {
      return { summaries: [], unreadable: 0 }
    }
    const summaries = Object.values(
      snapshot.val() as Record<string, GameSummaryRecord>
    )
    return { summaries, unreadable: 0 }
  }

  async deleteGame(gameId: string): Promise<void> {
    await this.run(() => this.ensureAuthenticated())
    await this.run(() =>
      update(ref(this.firebaseDatabase), {
        [`games/${gameId}`]: null,
        [`gameSummaries/${gameId}`]: null,
      })
    )
  }

  // ----------------------------------------------------------- instance lock

  async getInstanceLock(): Promise<InstanceLockRecord | null> {
    await this.run(() => this.ensureAuthenticated())
    const snapshot = await this.run(() =>
      get(ref(this.firebaseDatabase, INSTANCE_LOCK_PATH))
    )
    if (!snapshot.exists()) return null
    return snapshot.val() as InstanceLockRecord
  }

  async acquireInstanceLock(
    record: InstanceLockRecord,
    staleMs: number = INSTANCE_LOCK_STALE_MS
  ): Promise<boolean> {
    await this.run(() => this.ensureAuthenticated())
    const result = await this.run(() =>
      runTransaction(
        ref(this.firebaseDatabase, INSTANCE_LOCK_PATH),
        (current) => {
          const existing = current as InstanceLockRecord | null
          if (existing !== null && !isStaleInstanceLock(existing, staleMs)) {
            // Другой инстанс hält актуальную блокировку: отменяем транзакцию.
            return current
          }
          return record
        }
      )
    )
    const committed = result.snapshot.val() as InstanceLockRecord | null
    return Boolean(committed && committed.instanceId === record.instanceId)
  }

  async renewInstanceLockHeartbeat(instanceId: string): Promise<boolean> {
    await this.run(() => this.ensureAuthenticated())
    const result = await this.run(() =>
      runTransaction(
        ref(this.firebaseDatabase, INSTANCE_LOCK_PATH),
        (current) => {
          const record = current as InstanceLockRecord | null
          if (!record || record.instanceId !== instanceId) return current
          return { ...record, heartbeatAt: Date.now() }
        }
      )
    )
    const committed = result.snapshot.val() as InstanceLockRecord | null
    return Boolean(committed && committed.instanceId === instanceId)
  }

  async releaseInstanceLock(instanceId: string): Promise<void> {
    await this.run(() => this.ensureAuthenticated())
    await this.run(() =>
      runTransaction(
        ref(this.firebaseDatabase, INSTANCE_LOCK_PATH),
        (current) => {
          const record = current as InstanceLockRecord | null
          if (!record || record.instanceId !== instanceId) return current
          return null
        }
      )
    )
  }
}

/** Путь к записи блокировки инстанса в корне хранилища. */
const INSTANCE_LOCK_PATH = 'instanceLock'

function isStaleInstanceLock(
  record: InstanceLockRecord,
  staleMs: number
): boolean {
  return Date.now() - record.heartbeatAt > staleMs
}

let firebaseGameDatabase: GameDatabase | undefined

export function createProductionGameDatabase(
  environment: NodeJS.ProcessEnv = process.env
): IGameDatabase {
  return (firebaseGameDatabase ??= new GameDatabase(
    getFirebaseConfig(environment)
  ))
}
