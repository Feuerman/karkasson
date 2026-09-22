import type { IGameBoard } from '../../../server/src/modules/GameManager'
import type { IGameDatabase } from '../../../server/src/modules/Database'

/**
 * Хранилище игр в памяти вместо Firebase.
 * Клонирует состояние как это делает Firebase (сериализация в строку),
 * поэтому сохранённые игры возвращаются как plain-объекты без методов.
 */
export interface InMemoryStore {
  games: Record<string, IGameBoard>
}

export function createInMemoryStore(): InMemoryStore {
  return { games: {} }
}

export class InMemoryDatabase implements IGameDatabase {
  constructor(private readonly store: InMemoryStore = { games: {} }) {}

  async saveGame(gameId: string, gameState: IGameBoard): Promise<void> {
    const state = JSON.parse(JSON.stringify(gameState)) as IGameBoard
    state.lastUpdate = Date.now()
    this.store.games[gameId] = state
  }

  async getGame(gameId: string): Promise<IGameBoard | null> {
    return this.store.games[gameId] ?? null
  }

  async getAllGames(): Promise<IGameBoard[]> {
    return Object.keys(this.store.games)
      .map((id) => this.store.games[id])
      .filter(Boolean)
  }

  async saveAllGames(games: IGameBoard[]): Promise<void> {
    for (const game of games) {
      if (!game.id) continue
      await this.saveGame(game.id, game)
    }
  }

  async deleteGame(gameId: string): Promise<void> {
    delete this.store.games[gameId]
  }
}
