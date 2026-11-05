import { MAX_SOCKETS_PER_IP, TRUST_PROXY } from '../config'
import { createLogger } from '../utils/logger'

const logger = createLogger('abuseGuard')

export interface ClientSocketLike {
  handshake: {
    address: string
    headers: Record<string, string | string[] | undefined>
  }
}

export interface SocketAbuseGuardOptions {
  maxSocketsPerIp?: number
  commandBurst?: number
  commandRefillPerSecond?: number
  ipCommandBurst?: number
  ipCommandRefillPerSecond?: number
  joinAttemptWindowMs?: number
  joinDelayThreshold?: number
  joinDelayStepMs?: number
  joinDelayMaxMs?: number
  joinBlockThreshold?: number
  joinBlockMs?: number
  trustProxy?: boolean
  now?: () => number
}

interface TokenBucket {
  tokens: number
  updatedAt: number
}

interface JoinAttemptState {
  failures: number[]
  blockedUntil: number
}

export type CommandLimitResult =
  { allowed: true } | { allowed: false; reason: 'socket' | 'ip' }

export interface JoinFailureResult {
  blocked: boolean
  delayMs: number
}

type ResolvedOptions = Required<Omit<SocketAbuseGuardOptions, 'now'>> & {
  now: () => number
}

/**
 * Локальные для одного сервера ограничители злоупотреблений.
 *
 * Класс не знает правил игры и не пишет в хранилище: он только считает
 * сокеты, команды и неудачные входы. Часы и лимиты можно подменить в тестах.
 */
export class SocketAbuseGuard {
  private readonly options: ResolvedOptions
  private readonly socketsByIp = new Map<string, number>()
  private readonly ipBySocket = new Map<string, string>()
  private readonly socketBuckets = new Map<string, TokenBucket>()
  private readonly ipBuckets = new Map<string, TokenBucket>()
  private readonly joinAttempts = new Map<string, JoinAttemptState>()

  constructor(options: SocketAbuseGuardOptions = {}) {
    this.options = {
      maxSocketsPerIp: options.maxSocketsPerIp ?? MAX_SOCKETS_PER_IP,
      commandBurst: options.commandBurst ?? 40,
      commandRefillPerSecond: options.commandRefillPerSecond ?? 20,
      ipCommandBurst: options.ipCommandBurst ?? 120,
      ipCommandRefillPerSecond: options.ipCommandRefillPerSecond ?? 60,
      joinAttemptWindowMs: options.joinAttemptWindowMs ?? 10 * 60 * 1000,
      joinDelayThreshold: options.joinDelayThreshold ?? 3,
      joinDelayStepMs: options.joinDelayStepMs ?? 250,
      joinDelayMaxMs: options.joinDelayMaxMs ?? 1_500,
      joinBlockThreshold: options.joinBlockThreshold ?? 8,
      joinBlockMs: options.joinBlockMs ?? 10 * 60 * 1000,
      trustProxy: options.trustProxy ?? TRUST_PROXY,
      now: options.now ?? (() => Date.now()),
    }
  }

  /**
   * IP клиента. `X-Forwarded-For` учитывается только при явном доверии
   * прокси: иначе клиент подделал бы заголовок и обошёл ограничения.
   */
  clientIp(socket: ClientSocketLike): string {
    if (this.options.trustProxy) {
      const forwarded = socket.handshake.headers['x-forwarded-for']
      const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
      const first = value?.split(',')[0]?.trim()
      if (first) return first
    }
    return socket.handshake.address || 'unknown'
  }

  canAcceptConnection(ip: string): boolean {
    return (this.socketsByIp.get(ip) ?? 0) < this.options.maxSocketsPerIp
  }

  addConnection(socketId: string, ip: string): void {
    this.ipBySocket.set(socketId, ip)
    this.socketsByIp.set(ip, (this.socketsByIp.get(ip) ?? 0) + 1)
  }

  removeConnection(socketId: string): void {
    const ip = this.ipBySocket.get(socketId)
    if (ip) {
      const count = (this.socketsByIp.get(ip) ?? 1) - 1
      if (count > 0) this.socketsByIp.set(ip, count)
      else this.socketsByIp.delete(ip)
    }
    this.ipBySocket.delete(socketId)
    this.socketBuckets.delete(socketId)
  }

  /** Списывает токен частоты и с сокета, и с IP. */
  tryConsumeCommand(socketId: string, ip: string): CommandLimitResult {
    const socketAllowed = this.takeToken(
      this.socketBuckets,
      socketId,
      this.options.commandBurst,
      this.options.commandRefillPerSecond
    )
    if (!socketAllowed) return { allowed: false, reason: 'socket' }

    const ipAllowed = this.takeToken(
      this.ipBuckets,
      ip,
      this.options.ipCommandBurst,
      this.options.ipCommandRefillPerSecond
    )
    if (!ipAllowed) {
      this.refundToken(this.socketBuckets, socketId, this.options.commandBurst)
      return { allowed: false, reason: 'ip' }
    }

    return { allowed: true }
  }

  isJoinBlocked(ip: string): boolean {
    const state = this.joinAttempts.get(ip)
    if (!state) return false
    if (state.blockedUntil > this.options.now()) return true
    if (state.blockedUntil !== 0) state.blockedUntil = 0
    return false
  }

  /**
   * Записывает неудачный вход и возвращает задержку перед ответом либо
   * признак блокировки после серии попыток за окно времени.
   */
  recordJoinFailure(ip: string): JoinFailureResult {
    const now = this.options.now()
    const state = this.joinAttempts.get(ip) ?? {
      failures: [],
      blockedUntil: 0,
    }
    state.failures = state.failures.filter(
      (timestamp) => now - timestamp <= this.options.joinAttemptWindowMs
    )
    state.failures.push(now)
    this.joinAttempts.set(ip, state)

    if (state.failures.length >= this.options.joinBlockThreshold) {
      state.failures = []
      state.blockedUntil = now + this.options.joinBlockMs
      logger.warn(`Too many failed join attempts from ${ip}`)
      return { blocked: true, delayMs: 0 }
    }

    const excess = state.failures.length - this.options.joinDelayThreshold
    return {
      blocked: false,
      delayMs:
        excess > 0
          ? Math.min(
              this.options.joinDelayMaxMs,
              excess * this.options.joinDelayStepMs
            )
          : 0,
    }
  }

  recordJoinSuccess(ip: string): void {
    this.joinAttempts.delete(ip)
  }

  private takeToken(
    buckets: Map<string, TokenBucket>,
    key: string,
    capacity: number,
    refillPerSecond: number
  ): boolean {
    if (capacity < 1) return false

    const now = this.options.now()
    const bucket = buckets.get(key)
    if (!bucket) {
      buckets.set(key, { tokens: capacity - 1, updatedAt: now })
      return true
    }

    const elapsedSeconds = Math.max(0, now - bucket.updatedAt) / 1_000
    bucket.tokens = Math.min(
      capacity,
      bucket.tokens + elapsedSeconds * refillPerSecond
    )
    bucket.updatedAt = now

    if (bucket.tokens < 1) return false
    bucket.tokens -= 1
    return true
  }

  private refundToken(
    buckets: Map<string, TokenBucket>,
    key: string,
    capacity: number
  ): void {
    const bucket = buckets.get(key)
    if (!bucket) return
    bucket.tokens = Math.min(capacity, bucket.tokens + 1)
  }
}
