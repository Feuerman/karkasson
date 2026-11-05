import { createPrivateKey, sign } from 'node:crypto'
import type { FirebaseServiceAccount } from '../config'

const CUSTOM_TOKEN_AUDIENCE =
  'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit'

// UID и claim, по которым правила Realtime Database отличают сервер от клиента.
export const SERVER_UID = 'karkasson-server'
export const SERVER_CLAIM = 'server'

const DEFAULT_TTL_SECONDS = 60 * 60
const MAX_TTL_SECONDS = 60 * 60
const CLOCK_SKEW_SECONDS = 60

export interface ServerCustomTokenOptions {
  uid?: string
  claims?: Record<string, unknown>
  issuedAtSeconds?: number
  ttlSeconds?: number
}

interface CustomTokenHeader {
  alg: 'RS256'
  typ: 'JWT'
}

interface CustomTokenPayload {
  iss: string
  sub: string
  aud: string
  iat: number
  exp: number
  uid: string
  claims: Record<string, unknown>
}

function toBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url')
}

/**
 * Создаёт Firebase custom token от имени сервисного аккаунта.
 *
 * Токен меняется на ID token через Firebase Auth; в ID token попадают claim'ы
 * `server: true` и `uid`, поэтому правила базы пускают только такой сервер.
 * Приватный ключ никогда не покидает сервер.
 */
export function createServerCustomToken(
  serviceAccount: FirebaseServiceAccount,
  options: ServerCustomTokenOptions = {}
): string {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS
  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds <= 0 ||
    ttlSeconds > MAX_TTL_SECONDS
  ) {
    throw new Error(
      `Custom token TTL must be an integer from 1 to ${MAX_TTL_SECONDS} seconds`
    )
  }

  const now = options.issuedAtSeconds ?? Math.floor(Date.now() / 1000)
  if (!Number.isInteger(now) || now <= 0) {
    throw new Error('Custom token issue time must be a positive integer')
  }

  const header: CustomTokenHeader = { alg: 'RS256', typ: 'JWT' }
  const payload: CustomTokenPayload = {
    iss: serviceAccount.clientEmail,
    sub: serviceAccount.clientEmail,
    aud: CUSTOM_TOKEN_AUDIENCE,
    iat: now - CLOCK_SKEW_SECONDS,
    exp: now - CLOCK_SKEW_SECONDS + ttlSeconds,
    uid: options.uid ?? SERVER_UID,
    claims: options.claims ?? { [SERVER_CLAIM]: true },
  }

  const unsigned = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(
    JSON.stringify(payload)
  )}`
  const signature = sign(
    'RSA-SHA256',
    Buffer.from(unsigned, 'utf8'),
    createPrivateKey(serviceAccount.privateKey)
  )

  return `${unsigned}.${toBase64Url(signature)}`
}
