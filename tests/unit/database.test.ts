import { describe, expect, it } from 'vitest'
import {
  createProductionGameDatabase,
  InMemoryGameDatabase,
} from '@server/modules/Database'
import { getFirebaseConfig } from '@server/config'
import { GameManager } from '@server/modules/GameManager'
import { serializeGameState } from '@server/modules/gameSave'

describe('База данных сервера', () => {
  it('создаёт in-memory хранилище без внешних ресурсов', () => {
    expect(new InMemoryGameDatabase()).toBeInstanceOf(InMemoryGameDatabase)
  })

  it('не поднимает Firebase без обязательных переменных окружения', () => {
    expect(() =>
      createProductionGameDatabase({ NODE_ENV: 'production' })
    ).toThrow(/FIREBASE_API_KEY/)
    expect(() =>
      createProductionGameDatabase({
        NODE_ENV: 'production',
        FIREBASE_API_KEY: 'test-key',
      })
    ).toThrow(/FIREBASE_DATABASE_URL/)
    expect(() =>
      createProductionGameDatabase({
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

    await database.saveGame(game.id, serializeGameState(game))

    const savedGames = await database.getAllGameSaves()
    expect(savedGames).toHaveLength(1)
    expect(await database.getGame(game.id)).toMatchObject({ id: game.id })
    expect(await database.getGameSummaries()).toMatchObject([{ id: game.id }])

    await database.deleteGame(game.id)
    expect(await database.getAllGameSaves()).toEqual([])
    expect(await database.getGameSummaries()).toEqual([])
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
