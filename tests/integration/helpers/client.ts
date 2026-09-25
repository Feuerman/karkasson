import { io, type Socket } from 'socket.io-client'

interface Waiter {
  predicate: (payload: unknown) => boolean
  cleanup: () => void
  resolve: (payload: unknown) => void
  reject: (error: Error) => void
}

/**
 * Тонкая обёртка над socket.io-client для тестов:
 * ждёт соединения, слушает события в «почтовый ящик» и умеет
 * дожидаться нужного события с предикатом.
 */
export class TestClient {
  readonly socket: Socket
  readonly deviceId: string
  private inbox: Map<string, unknown[]> = new Map()
  private waiters: Map<string, Waiter[]> = new Map()

  constructor(url: string, deviceId: string) {
    this.deviceId = deviceId
    this.socket = io(url, {
      transports: ['websocket'],
      forceNew: true,
      autoConnect: false,
      reconnection: false,
    })

    this.socket.onAny((event, payload) => {
      if (!this.inbox.has(event)) this.inbox.set(event, [])
      this.inbox.get(event)!.push(payload)

      const pending = this.waiters.get(event)
      if (pending) {
        for (let i = pending.length - 1; i >= 0; i--) {
          if (pending[i].predicate(payload)) {
            const waiter = pending[i]
            pending.splice(i, 1)
            waiter.cleanup()
            waiter.resolve(payload)
          }
        }
      }
    })
  }

  async connect(): Promise<void> {
    if (this.socket.connected) return

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error('Socket connect timeout'))
      }, 10_000)

      const onConnect = () => {
        cleanup()
        resolve()
      }
      const onError = (error: Error) => {
        cleanup()
        reject(error)
      }
      const cleanup = () => {
        clearTimeout(timer)
        this.socket.off('connect', onConnect)
        this.socket.off('connect_error', onError)
      }

      this.socket.once('connect', onConnect)
      this.socket.once('connect_error', onError)
      this.socket.connect()
    })
  }

  registerDevice(): void {
    this.socket.emit('registerDevice', { deviceId: this.deviceId })
  }

  /** emit с acknowledgement-колбэком сервера */
  emitAck<T = unknown>(event: string, payload?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const onAck = (error: Error | null, response: unknown) => {
        if (error) {
          reject(error)
          return
        }
        const resp = response as Record<string, unknown> | undefined
        if (resp && typeof resp === 'object' && 'error' in resp) {
          reject(new Error(String(resp.error)))
          return
        }
        resolve(response as T)
      }

      // undefined-пейлоад нельзя передавать как аргумент: серверный колбэк
      // тогда приходит как второй аргумент (undefined, callback) и теряется
      if (payload === undefined) {
        this.socket.timeout(10_000).emit(event, onAck)
      } else {
        this.socket.timeout(10_000).emit(event, payload, onAck)
      }
    })
  }

  emit(event: string, payload?: unknown): void {
    this.socket.emit(event, payload)
  }

  /**
   * Дожидается события (уже полученное тоже подхватывает из «ящика»).
   * Возвращает первый payload, удовлетворяющий предикату.
   */
  async waitForEvent(
    event: string,
    predicate: (payload: unknown) => boolean = () => true,
    timeoutMs = 10_000
  ): Promise<unknown> {
    const existing = this.takeFromInbox(event, predicate)
    if (existing.found) return existing.payload

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiter.reject(new Error(`Timeout waiting for event "${event}"`))
      }, timeoutMs)
      const waiter: Waiter = {
        predicate,
        cleanup: () => {
          clearTimeout(timer)
          const pending = this.waiters.get(event)
          if (!pending) return
          const index = pending.indexOf(waiter)
          if (index !== -1) pending.splice(index, 1)
        },
        resolve: (payload) => {
          waiter.cleanup()
          resolve(payload)
        },
        reject: (error) => {
          waiter.cleanup()
          reject(error)
        },
      }

      if (!this.waiters.has(event)) this.waiters.set(event, [])
      this.waiters.get(event)!.push(waiter)
    })
  }

  private takeFromInbox(
    event: string,
    predicate: (payload: unknown) => boolean
  ): { found: boolean; payload: unknown } {
    const items = this.inbox.get(event)
    if (!items) return { found: false, payload: undefined }
    const index = items.findIndex((item) => predicate(item))
    if (index === -1) return { found: false, payload: undefined }
    const [payload] = items.splice(index, 1)
    return { found: true, payload }
  }

  get id(): string | undefined {
    return this.socket.id
  }

  connected(): boolean {
    return this.socket.connected
  }

  /** Разрыв основного транспорта → сервер увидит «transport close» (временное отключение) */
  closeTransport(): void {
    this.socket.io.engine?.close?.()
  }

  /** Полное отключение клиента */
  disconnect(): void {
    this.socket.disconnect()
  }

  /** Переподключение (новая сессия на том же клиенте) */
  reconnect(): void {
    this.socket.connect()
  }

  dispose(): void {
    this.inbox.clear()
    this.waiters.clear()
    this.socket.removeAllListeners()
    this.socket.disconnect()
    const manager = this.socket.io as unknown as { _close?: () => void }
    manager._close?.()
  }
}

export { io }
