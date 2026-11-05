import { describe, expect, it } from 'vitest'
import {
  SocketAbuseGuard,
  type ClientSocketLike,
} from '@server/socket/abuseGuard'

function socketAt(
  address: string,
  headers: Record<string, string | string[] | undefined> = {}
): ClientSocketLike {
  return { handshake: { address, headers } }
}

function clock(start = 1_000): {
  now: () => number
  advance: (ms: number) => void
} {
  let current = start
  return {
    now: () => current,
    advance: (ms) => {
      current += ms
    },
  }
}

describe('SocketAbuseGuard', () => {
  it('берёт IP из handshake и доверяет X-Forwarded-For только по настройке', () => {
    const direct = new SocketAbuseGuard({ trustProxy: false })
    expect(
      direct.clientIp(
        socketAt('127.0.0.1', { 'x-forwarded-for': '203.0.113.7' })
      )
    ).toBe('127.0.0.1')

    const proxied = new SocketAbuseGuard({ trustProxy: true })
    expect(
      proxied.clientIp(
        socketAt('127.0.0.1', {
          'x-forwarded-for': '203.0.113.7, 10.0.0.1',
        })
      )
    ).toBe('203.0.113.7')
    expect(
      proxied.clientIp(
        socketAt('127.0.0.1', {
          'x-forwarded-for': ['198.51.100.2', '10.0.0.1'],
        })
      )
    ).toBe('198.51.100.2')
    expect(proxied.clientIp(socketAt(''))).toBe('unknown')
  })

  it('считает сокеты на IP и освобождает их при отключении', () => {
    const guard = new SocketAbuseGuard({ maxSocketsPerIp: 2 })
    expect(guard.canAcceptConnection('ip')).toBe(true)
    guard.addConnection('s1', 'ip')
    guard.addConnection('s2', 'ip')
    expect(guard.canAcceptConnection('ip')).toBe(false)
    guard.removeConnection('s1')
    expect(guard.canAcceptConnection('ip')).toBe(true)
    guard.removeConnection('unknown')
  })

  it('ограничивает частоту команд на сокет и на IP', () => {
    const time = clock()
    const guard = new SocketAbuseGuard({
      commandBurst: 2,
      commandRefillPerSecond: 0,
      ipCommandBurst: 3,
      ipCommandRefillPerSecond: 0,
      now: time.now,
    })

    expect(guard.tryConsumeCommand('s1', 'ip')).toEqual({ allowed: true })
    expect(guard.tryConsumeCommand('s1', 'ip')).toEqual({ allowed: true })
    expect(guard.tryConsumeCommand('s1', 'ip')).toEqual({
      allowed: false,
      reason: 'socket',
    })
    expect(guard.tryConsumeCommand('s2', 'ip')).toEqual({ allowed: true })
    expect(guard.tryConsumeCommand('s3', 'ip')).toEqual({
      allowed: false,
      reason: 'ip',
    })
  })

  it('восстанавливает токены со временем', () => {
    const time = clock()
    const guard = new SocketAbuseGuard({
      commandBurst: 1,
      commandRefillPerSecond: 1,
      ipCommandBurst: 10,
      ipCommandRefillPerSecond: 0,
      now: time.now,
    })

    expect(guard.tryConsumeCommand('s1', 'ip')).toEqual({ allowed: true })
    expect(guard.tryConsumeCommand('s1', 'ip')).toEqual({
      allowed: false,
      reason: 'socket',
    })
    time.advance(1_000)
    expect(guard.tryConsumeCommand('s1', 'ip')).toEqual({ allowed: true })
  })

  it('задерживает и блокирует перебор кодов комнат', () => {
    const time = clock()
    const guard = new SocketAbuseGuard({
      joinAttemptWindowMs: 10_000,
      joinDelayThreshold: 1,
      joinDelayStepMs: 100,
      joinDelayMaxMs: 150,
      joinBlockThreshold: 4,
      joinBlockMs: 1_000,
      now: time.now,
    })

    expect(guard.recordJoinFailure('ip')).toEqual({
      blocked: false,
      delayMs: 0,
    })
    expect(guard.recordJoinFailure('ip')).toEqual({
      blocked: false,
      delayMs: 100,
    })
    expect(guard.recordJoinFailure('ip')).toEqual({
      blocked: false,
      delayMs: 150,
    })
    expect(guard.recordJoinFailure('ip')).toEqual({
      blocked: true,
      delayMs: 0,
    })
    expect(guard.isJoinBlocked('ip')).toBe(true)

    time.advance(1_001)
    expect(guard.isJoinBlocked('ip')).toBe(false)
  })

  it('успешный вход сбрасывает счётчик неудач', () => {
    const time = clock()
    const guard = new SocketAbuseGuard({
      joinDelayThreshold: 2,
      joinBlockThreshold: 3,
      now: time.now,
    })

    guard.recordJoinFailure('ip')
    guard.recordJoinSuccess('ip')
    expect(guard.recordJoinFailure('ip')).toEqual({
      blocked: false,
      delayMs: 0,
    })
    expect(guard.isJoinBlocked('ip')).toBe(false)
  })

  it('ограничивает частоту запуска партий с компьютерами', () => {
    const time = clock()
    const guard = new SocketAbuseGuard({
      aiGameStartBurst: 2,
      aiGameStartRefillPerSecond: 1 / 60,
      now: time.now,
    })

    expect(guard.tryConsumeAiGameStart('ip')).toBe(true)
    expect(guard.tryConsumeAiGameStart('ip')).toBe(true)
    expect(guard.tryConsumeAiGameStart('ip')).toBe(false)

    time.advance(60_000)
    expect(guard.tryConsumeAiGameStart('ip')).toBe(true)
    expect(guard.tryConsumeAiGameStart('other-ip')).toBe(true)
  })
})
