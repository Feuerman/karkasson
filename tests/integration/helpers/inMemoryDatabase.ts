import type {
  GameSavePayload,
  GameSummaryRecord,
  IGameDatabase,
  RawGameSave,
} from '@server/modules/Database'
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
    serializedState: GameSavePayload
  ): Promise<void> {
    if (this.beforeSave) await this.beforeSave(gameId, serializedState)
    if (this.saveError) throw this.saveError
    this.store.games[gameId] = serializedState
  }

  async getGame(gameId: string): Promise<IGameState | null> {
    if (this.readError) throw this.readError
    return readStoredGame(this.store, gameId)
  }

  async getAllGameSaves(): Promise<RawGameSave[]> {
    if (this.readError) throw this.readError
    return Object.values(this.store.games)
  }

  async getGameSummaries(): Promise<GameSummaryRecord[]> {
    if (this.readError) throw this.readError
    const summaries: GameSummaryRecord[] = []
    for (const payload of Object.values(this.store.games)) {
      const summary = readGameSummary(payload)
      if (summary) summaries.push(summary)
    }
    return summaries
  }

  async deleteGame(gameId: string): Promise<void> {
    delete this.store.games[gameId]
  }
}

/** Кладёт партию в тестовое хранилище тем же путём, что и сервер. */
export function storeGame(store: InMemoryStore, game: IGameState): void {
  if (!game.id) return
  store.games[game.id] = serializeGameState(game)
}
