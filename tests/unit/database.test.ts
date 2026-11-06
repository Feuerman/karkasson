import { generateKeyPairSync, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  createProductionGameDatabase,
  InMemoryGameDatabase,
} from '@server/modules/Database'
import { getFirebaseConfig } from '@server/config'
import {
  createServerCustomToken,
  SERVER_UID,
} from '@server/modules/firebaseAuth'
import { GameManager } from '@server/modules/GameManager'
import { serializeGameState } from '@server/modules/gameSave'

const keyPair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

const serviceAccountFields = {
  project_id: 'karkasson-test',
  client_email: 'server@karkasson-test.iam.gserviceaccount.com',
  private_key: keyPair.privateKey,
}

const serviceAccount = {
  projectId: serviceAccountFields.project_id,
  clientEmail: serviceAccountFields.client_email,
  privateKey: serviceAccountFields.private_key.trim(),
}

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
        FIREBASE_API_KEY: 'test-key',
        FIREBASE_DATABASE_URL: 'https://example.firebaseio.com/',
      })
    ).toThrow(/FIREBASE_SERVICE_ACCOUNT/)
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
    expect(await database.getGameSummaries()).toMatchObject({
      summaries: [{ id: game.id }],
    })

    await database.deleteGame(game.id)
    expect(await database.getAllGameSaves()).toEqual([])
    expect(await database.getGameSummaries()).toEqual({
      summaries: [],
      unreadable: 0,
    })
  })
})

describe('Конфигурация Firebase', () => {
  it('читает обязательные значения и сервисный аккаунт', () => {
    expect(
      getFirebaseConfig({
        FIREBASE_API_KEY: ' test-key ',
        FIREBASE_DATABASE_URL: 'https://test.firebaseio.com/',
        FIREBASE_SERVICE_ACCOUNT: JSON.stringify(serviceAccountFields),
      })
    ).toEqual({
      apiKey: 'test-key',
      databaseURL: 'https://test.firebaseio.com/',
      serviceAccount,
    })
  })

  it('восстанавливает экранированные переносы приватного ключа', () => {
    const escapedKey = serviceAccountFields.private_key.replace(/\n/g, '\\n')
    const config = getFirebaseConfig({
      FIREBASE_API_KEY: 'test-key',
      FIREBASE_DATABASE_URL: 'https://test.firebaseio.com/',
      FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
        ...serviceAccountFields,
        private_key: escapedKey,
      }),
    })

    expect(config.serviceAccount.privateKey).toBe(serviceAccount.privateKey)
  })

  it('сообщает имя отсутствующей обязательной переменной', () => {
    const missingApiKey = () => getFirebaseConfig({})
    const missingDatabaseUrl = () =>
      getFirebaseConfig({ FIREBASE_API_KEY: 'test-key' })
    const missingServiceAccount = () =>
      getFirebaseConfig({
        FIREBASE_API_KEY: 'test-key',
        FIREBASE_DATABASE_URL: 'https://test.firebaseio.com/',
      })

    expect(missingApiKey).toThrow(
      'Missing required environment variable FIREBASE_API_KEY'
    )
    expect(missingDatabaseUrl).toThrow(
      'Missing required environment variable FIREBASE_DATABASE_URL'
    )
    expect(missingServiceAccount).toThrow(
      'Missing required environment variable FIREBASE_SERVICE_ACCOUNT'
    )
  })

  it('отклоняет некорректный сервисный аккаунт', () => {
    const base = {
      FIREBASE_API_KEY: 'test-key',
      FIREBASE_DATABASE_URL: 'https://test.firebaseio.com/',
    }

    expect(() =>
      getFirebaseConfig({ ...base, FIREBASE_SERVICE_ACCOUNT: 'not-json' })
    ).toThrow(/valid JSON/)
    expect(() =>
      getFirebaseConfig({ ...base, FIREBASE_SERVICE_ACCOUNT: 'null' })
    ).toThrow(/JSON object/)
    expect(() =>
      getFirebaseConfig({
        ...base,
        FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
          project_id: 'karkasson-test',
        }),
      })
    ).toThrow(/project_id, client_email and private_key/)
    expect(() =>
      getFirebaseConfig({
        ...base,
        FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
          ...serviceAccountFields,
          private_key: 'not-a-key',
        }),
      })
    ).toThrow(/not a valid PEM key/)
  })
})

describe('Серверный custom token Firebase', () => {
  it('подписывает токен ключом сервисного аккаунта', () => {
    const issuedAt = 1_700_000_000
    const token = createServerCustomToken(serviceAccount, {
      issuedAtSeconds: issuedAt,
    })
    const [headerPart, payloadPart, signaturePart] = token.split('.')
    const header = decodeJson(headerPart)
    const payload = decodeJson(payloadPart)

    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(payload).toMatchObject({
      iss: serviceAccount.clientEmail,
      sub: serviceAccount.clientEmail,
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat: issuedAt - 60,
      exp: issuedAt - 60 + 60 * 60,
      uid: SERVER_UID,
      claims: { server: true },
    })

    expect(
      verify(
        'RSA-SHA256',
        Buffer.from(`${headerPart}.${payloadPart}`),
        keyPair.publicKey,
        Buffer.from(signaturePart, 'base64url')
      )
    ).toBe(true)
  })

  it('принимает свои uid и claims и проверяет TTL', () => {
    const token = createServerCustomToken(serviceAccount, {
      uid: 'custom-server',
      claims: { server: true, role: 'writer' },
      issuedAtSeconds: 1_700_000_000,
      ttlSeconds: 600,
    })
    const payload = decodeJson(token.split('.')[1])

    expect(payload).toMatchObject({
      uid: 'custom-server',
      exp: 1_700_000_000 - 60 + 600,
      claims: { server: true, role: 'writer' },
    })

    expect(() =>
      createServerCustomToken(serviceAccount, { ttlSeconds: 0 })
    ).toThrow(/TTL/)
    expect(() =>
      createServerCustomToken(serviceAccount, { ttlSeconds: 60 * 61 })
    ).toThrow(/TTL/)
    expect(() =>
      createServerCustomToken(serviceAccount, { issuedAtSeconds: 0 })
    ).toThrow(/issue time/)
  })
})

function decodeJson(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
}
