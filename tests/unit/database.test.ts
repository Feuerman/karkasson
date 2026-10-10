import { describe, expect, it } from 'vitest'
import {
  createGameDatabase,
  gameDatabase,
  InMemoryGameDatabase,
} from '@server/modules/Database'
import { getFirebaseConfig } from '@server/config'
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

  it('не поднимает Firebase без обязательных переменных окружения', () => {
    expect(() => createGameDatabase({ NODE_ENV: 'production' })).toThrow(
      /FIREBASE_API_KEY/
    )
    expect(() =>
      createGameDatabase({
        NODE_ENV: 'production',
        FIREBASE_API_KEY: 'test-key',
      })
    ).toThrow(/FIREBASE_DATABASE_URL/)
    expect(() =>
      createGameDatabase({
        NODE_ENV: 'production',
        FIREBASE_API_KEY: '   ',
        FIREBASE_DATABASE_URL: 'https://example.firebaseio.com/',
      })
    ).toThrow(/FIREBASE_API_KEY/)
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

describe('Конфигурация Firebase', () => {
  it('читает обязательные и необязательные значения из окружения', () => {
    expect(
      getFirebaseConfig({
        FIREBASE_API_KEY: ' test-key ',
        FIREBASE_DATABASE_URL: 'https://test.firebaseio.com/',
        FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
        FIREBASE_PROJECT_ID: 'test',
        FIREBASE_STORAGE_BUCKET: 'test.firebasestorage.app',
        FIREBASE_MESSAGING_SENDER_ID: '142905740344',
        FIREBASE_APP_ID: '1:142905740344:web:test',
        FIREBASE_MEASUREMENT_ID: 'G-TEST',
      })
    ).toEqual({
      apiKey: 'test-key',
      databaseURL: 'https://test.firebaseio.com/',
      authDomain: 'test.firebaseapp.com',
      projectId: 'test',
      storageBucket: 'test.firebasestorage.app',
      messagingSenderId: '142905740344',
      appId: '1:142905740344:web:test',
      measurementId: 'G-TEST',
    })
  })

  it('не добавляет незаданные необязательные поля', () => {
    expect(
      getFirebaseConfig({
        FIREBASE_API_KEY: 'test-key',
        FIREBASE_DATABASE_URL: 'https://test.firebaseio.com/',
        FIREBASE_PROJECT_ID: '   ',
      })
    ).toEqual({
      apiKey: 'test-key',
      databaseURL: 'https://test.firebaseio.com/',
    })
  })

  it('сообщает имя отсутствующей обязательной переменной', () => {
    expect(() => getFirebaseConfig({})).toThrow(
      'Missing required environment variable FIREBASE_API_KEY'
    )
    expect(() => getFirebaseConfig({ FIREBASE_API_KEY: 'test-key' })).toThrow(
      'Missing required environment variable FIREBASE_DATABASE_URL'
    )
  })
})
