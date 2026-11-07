import type { IGameDatabase, InstanceLockRecord } from './Database'
import { INSTANCE_LOCK_HEARTBEAT_MS, INSTANCE_LOCK_STALE_MS } from '../config'
import { createLogger } from '../utils/logger'

const logger = createLogger('instanceLock')

export interface InstanceLockOptions {
  db: IGameDatabase
  instanceId: string
  heartbeatMs?: number
  staleMs?: number
}

/**
 * Блокировка инстанса сервера в общем хранилище.
 *
 * Сервер задуман как single-instance: реестр партий в памяти, сокеты и
 * таймеры компьютера живут в одном процессе. Два инстанса на одной БД приведут
 * к потере команд и раздвоению партий, поэтому при старте второй процесс
 * отказывается запускаться, пока первый hält актуальную блокировку.
 *
 * Владелец обновляет heartbeat раз в `heartbeatMs`. Если процесс падает,
 * heartbeat застывает, и по истечении `staleMs` новый процесс может
 * забрать блокировку — это защита от зависшей записи после аварийного
 * завершения или параллельного деплоя.
 */
export class InstanceLock {
  private readonly db: IGameDatabase
  private readonly instanceId: string
  private readonly heartbeatMs: number
  private readonly staleMs: number
  private timer: ReturnType<typeof setInterval> | undefined
  private held = false

  constructor({
    db,
    instanceId,
    heartbeatMs = INSTANCE_LOCK_HEARTBEAT_MS,
    staleMs = INSTANCE_LOCK_STALE_MS,
  }: InstanceLockOptions) {
    this.db = db
    this.instanceId = instanceId
    this.heartbeatMs = heartbeatMs
    this.staleMs = staleMs
  }

  /** Забирает блокировку и начинает обновлять heartbeat. */
  async acquire(): Promise<boolean> {
    const record: InstanceLockRecord = {
      instanceId: this.instanceId,
      startedAt: Date.now(),
      heartbeatAt: Date.now(),
      pid: process.pid,
    }
    this.held = await this.db.acquireInstanceLock(record, this.staleMs)
    if (this.held) {
      this.startHeartbeat()
      logger.info(
        `Instance lock acquired (instanceId=${this.instanceId}, pid=${process.pid})`
      )
    } else {
      const current = await this.db.getInstanceLock()
      logger.warn(
        `Instance lock is held by another instance${
          current
            ? ` (instanceId=${current.instanceId}, pid=${current.pid})`
            : ''
        }; this process will not start`
      )
    }
    return this.held
  }

  /** Освобождает блокировку и останавливает heartbeat. Нужна при остановке. */
  async release(): Promise<void> {
    this.stopHeartbeat()
    if (this.held) {
      await this.db.releaseInstanceLock(this.instanceId).catch((error) => {
        logger.error('Failed to release instance lock:', error)
      })
      this.held = false
      logger.info(`Instance lock released (instanceId=${this.instanceId})`)
    }
  }

  /** Пока инстанс hält блокировку. */
  isHeld(): boolean {
    return this.held
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.timer = setInterval(() => {
      void this.db
        .renewInstanceLockHeartbeat(this.instanceId)
        .then((stillHeld) => {
          if (!stillHeld) {
            this.held = false
            this.stopHeartbeat()
            logger.warn(
              `Lost instance lock (instanceId=${this.instanceId}); another instance took over`
            )
          }
        })
        .catch((error: unknown) => {
          logger.error('Failed to refresh instance lock heartbeat:', error)
        })
    }, this.heartbeatMs)
    // Не удерживаем процесс из-за таймера heartbeat.
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref()
    }
  }

  private stopHeartbeat(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }
}

/**
 * Создаёт блокировку инстанса для переданного хранилища и идентификатора.
 * Перед стартом сервера нужно вызвать `acquire()`.
 */
export function createInstanceLock(options: InstanceLockOptions): InstanceLock {
  return new InstanceLock(options)
}
