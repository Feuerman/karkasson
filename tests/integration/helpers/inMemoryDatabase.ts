import type {
  GameSavePayload,
  GameSummariesResult,
  GameSummaryRecord,
  IGameDatabase,
  InstanceLockRecord,
  RawGameSave,
} from '@server/modules/Database'
import { INSTANCE_LOCK_STALE_MS } from '@server/config'
import type { IGameState } from '@server/modules/gameState'
import {
  deserializeGameState,
  readGameSummary,
  serializeGameState,
} from '@server/modules/gameSave'

/**
 * Хранилище игр в памяти вместо Firebase.
 *
 * Держит сохранения в том же виде, что и Firebase — строкой, — поэтому
 * поведение тестового сервера совпадает с продакшн: разбор и сборка формата
 * происходят в одном месте, а не в каждой реализации базы.
 */
export interface InMemoryStore {
  games: Record<string, GameSavePayload>
}

export function createInMemoryStore(): InMemoryStore {
  return { games: {} }
}

/** Разбор сохранения из тестового хранилища. */
export function readStoredGame(
  store: InMemoryStore,
  gameId: string
): IGameState | null {
  const payload = store.games[gameId]
  return payload ? deserializeGameState(payload) : null
}

export class InMemoryDatabase implements IGameDatabase {
  saveError: Error | null = null
  readError: Error | null = null
  private instanceLock: InstanceLockRecord | null = null
  /**
   * Хук перед записью. Нужен тестам, которые управляют временем записи:
   * задержать её, чтобы поймать следующую команду, или провалить, чтобы
   * проверить откат. `null` — запись идёт сразу.
   */
  beforeSave:
    ((gameId: string, state: GameSavePayload) => Promise<void>) | null = null

  constructor(private readonly store: InMemoryStore = { games: {} }) {}

  async saveGame(
    gameId: string,
    serializedState: GameSavePayload,
    _summary?: GameSummaryRecord
  ): Promise<void> {
    if (this.beforeSave) await this.beforeSave(gameId, serializedState)
    if (this.saveError) throw this.saveError
    this.store.games[gameId] = serializedState
  }

  async saveGameSummaries(_summaries: GameSummaryRecord[]): Promise<void> {
    // Сводки выводятся из сохранений, отдельный индекс не нужен.
  }

  async getGame(gameId: string): Promise<IGameState | null> {
    if (this.readError) throw this.readError
    return readStoredGame(this.store, gameId)
  }

  async getAllGameSaves(): Promise<RawGameSave[]> {
    if (this.readError) throw this.readError
    return Object.values(this.store.games)
  }

  async getGameSummaries(): Promise<GameSummariesResult> {
    if (this.readError) throw this.readError
    const summaries: GameSummaryRecord[] = []
    let unreadable = 0
    for (const payload of Object.values(this.store.games)) {
      const summary = readGameSummary(payload)
      if (summary) summaries.push(summary)
      else unreadable += 1
    }
    return { summaries, unreadable }
  }

  async deleteGame(gameId: string): Promise<void> {
    delete this.store.games[gameId]
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
    if (current && Date.now() - current.heartbeatAt > staleMs) {
      // Блокировка оставлена предыдущим процессом: забираем её.
    } else if (current) {
      return false
    }
    this.instanceLock = record
    return true
  }

  async renewInstanceLockHeartbeat(instanceId: string): Promise<boolean> {
    if (!this.instanceLock || this.instanceLock.instanceId !== instanceId) {
      return false
    }
    this.instanceLock = { ...this.instanceLock, heartbeatAt: Date.now() }
    return true
  }

  async releaseInstanceLock(instanceId: string): Promise<void> {
    if (this.instanceLock?.instanceId === instanceId) {
      this.instanceLock = null
    }
  }
}

/** Кладёт партию в тестовое хранилище тем же путём, что и сервер. */
export function storeGame(store: InMemoryStore, game: IGameState): void {
  if (!game.id) return
  store.games[game.id] = serializeGameState(game)
}
