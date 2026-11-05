/**
 * Токен серверной сессии.
 *
 * Клиент не придумывает идентичность: сервер сам выдаёт непрозрачный токен,
 * подписывает полезную нагрузку HMAC и принимает только подпись. Внутри —
 * случайный `sessionId` и время выдачи; имя, устройство и другие данные
 * клиента в токен не попадают.
 *
 * Подпись позволяет переживать перезапуск сервера без хранилища сессий: пока
 * секрет тот же, ранее выданный токен остаётся действительным.
 */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const TOKEN_VERSION = 'v1'
const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISSUED_AT_PATTERN = /^\d{1,16}$/

export interface SessionToken {
  token: string
  sessionId: string
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createSessionToken(
  secret: string,
  sessionId: string = randomUUID(),
  issuedAt: number = Date.now()
): SessionToken {
  const payload = `${TOKEN_VERSION}.${sessionId}.${issuedAt}`
  return {
    token: `${payload}.${sign(payload, secret)}`,
    sessionId,
  }
}

/**
 * Проверяет подпись и форму токена. Возвращает `sessionId` либо `undefined`:
 * неверный, обрезанный или чужой токен не должен ронять соединение — сервер
 * просто выдаст клиенту новую сессию.
 */
export function verifySessionToken(
  token: string,
  secret: string
): string | undefined {
  const parts = token.split('.')
  if (parts.length !== 4) return undefined

  const [version, sessionId, issuedAt, signature] = parts
  if (version !== TOKEN_VERSION) return undefined
  if (!SESSION_ID_PATTERN.test(sessionId)) return undefined
  if (!ISSUED_AT_PATTERN.test(issuedAt)) return undefined

  const expected = Buffer.from(
    sign(`${version}.${sessionId}.${issuedAt}`, secret)
  )
  const actual = Buffer.from(signature)
  if (actual.length !== expected.length) return undefined
  if (!timingSafeEqual(actual, expected)) return undefined

  return sessionId
}
