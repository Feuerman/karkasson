import { describe, expect, it } from 'vitest'
import {
  createGameDatabase,
  gameDatabase,
  InMemoryGameDatabase,
} from '@server/modules/Database'
import { GameManager } from '@server/modules/GameManager'

describe('База данных сервера', () => {
  it('использует память в режиме разработки и тестов', () => {
    expect(gameDatabase).toBeInstanceOf(InMemoryGameDatabase)
    expect(createGameDatabase({})).toBeInstanceOf(InMemoryGameDatabase)
    expect(createGameDatabase({ NODE_ENV: 'development' })).toBeInstanceOf(
      InMemoryGameDatabase
    )
    expect(createGameDatabase({ NODE_ENV: 'test' })).toBeInstanceOf(
      InMemoryGameDatabase
    )
  })

  it('сохраняет, загружает и удаляет игру из in-memory базы', async () => {
    const database = new InMemoryGameDatabase()
    const game = new GameManager({ players: [], startImmediately: false })
    game.id = 'local-game'

    await database.saveGame(game.id, game)

    const savedGames = await database.getAllGames()
    expect(savedGames).toHaveLength(1)
    expect(savedGames[0]?.id).toBe(game.id)
    expect(await database.getGame(game.id)).toMatchObject({ id: game.id })

    await database.deleteGame(game.id)
    expect(await database.getAllGames()).toEqual([])
  })
})
