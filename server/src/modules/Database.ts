import Database from 'better-sqlite3'
import { IGameBoard } from './GameManager'

class GameDatabase {
  private db: Database.Database

  constructor() {
    this.db = new Database('games.db')
    this.initDatabase()
  }

  private initDatabase() {
    // Создаем таблицу для хранения игр
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        gameState TEXT NOT NULL,
        lastUpdated INTEGER NOT NULL
      )
    `)
  }

  // Сохранение состояния игры
  saveGame(gameId: string, gameState: IGameBoard) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO games (id, gameState, lastUpdated)
      VALUES (?, ?, ?)
    `)

    stmt.run(
      gameId,
      JSON.stringify(gameState),
      Date.now()
    )
  }

  // Получение состояния игры
  getGame(gameId: string): IGameBoard | null {
    const stmt = this.db.prepare('SELECT gameState FROM games WHERE id = ?')
    const result = stmt.get(gameId)

    if (!result) {
      return null
    }

    return JSON.parse(result.gameState)
  }

  // Получение всех сохраненных игр
  getAllGames(): IGameBoard[] {
    const stmt = this.db.prepare('SELECT gameState FROM games')
    const results = stmt.all()

    return results.map(result => JSON.parse(result.gameState))
  }

  // Удаление игры
  deleteGame(gameId: string) {
    const stmt = this.db.prepare('DELETE FROM games WHERE id = ?')
    stmt.run(gameId)
  }
}

export const gameDatabase = new GameDatabase() 