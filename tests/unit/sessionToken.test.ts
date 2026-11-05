import { describe, expect, it } from 'vitest'
import {
  createSessionToken,
  verifySessionToken,
} from '@server/services/sessionToken'

const secret = 'test-session-secret-with-at-least-32-chars'

describe('sessionToken', () => {
  it('выдаёт токен, из которого восстанавливается та же сессия', () => {
    const session = createSessionToken(secret)

    expect(session.token.split('.')).toHaveLength(4)
    expect(verifySessionToken(session.token, secret)).toBe(session.sessionId)
  })

  it('принимает явные sessionId и issuedAt', () => {
    const sessionId = '8f14e45f-ceea-467a-9a5b-2a7d2fdd8a51'
    const session = createSessionToken(secret, sessionId, 1700000000000)

    expect(session.token.startsWith(`v1.${sessionId}.1700000000000.`)).toBe(
      true
    )
    expect(verifySessionToken(session.token, secret)).toBe(sessionId)
  })

  it('отклоняет токен с другой подписью', () => {
    const session = createSessionToken(secret)

    expect(verifySessionToken(session.token, `${secret}-other`)).toBeUndefined()
  })

  it('отклоняет изменённый sessionId', () => {
    const session = createSessionToken(secret)
    const [version, , issuedAt, signature] = session.token.split('.')
    const forged = `${version}.8f14e45f-ceea-467a-9a5b-2a7d2fdd8a51.${issuedAt}.${signature}`

    expect(verifySessionToken(forged, secret)).toBeUndefined()
  })

  it('отклоняет подпись другой длины', () => {
    const session = createSessionToken(secret)

    expect(verifySessionToken(`${session.token}x`, secret)).toBeUndefined()
  })

  it('отклоняет неверный формат, версию и sessionId', () => {
    const session = createSessionToken(secret)
    const [version, sessionId, issuedAt, signature] = session.token.split('.')

    expect(
      verifySessionToken(session.token.split('.').slice(1).join('.'), secret)
    ).toBeUndefined()
    expect(
      verifySessionToken(`v2.${sessionId}.${issuedAt}.${signature}`, secret)
    ).toBeUndefined()
    expect(
      verifySessionToken(
        `${version}.not-a-uuid.${issuedAt}.${signature}`,
        secret
      )
    ).toBeUndefined()
    expect(
      verifySessionToken(`v1.${sessionId}.abc.${signature}`, secret)
    ).toBeUndefined()
  })

  it('не принимает sessionId не в формате UUID', () => {
    const session = createSessionToken(secret, 'not-a-uuid')

    expect(verifySessionToken(session.token, secret)).toBeUndefined()
  })
})
