import { describe, expect, it } from 'vitest'
import {
  DatabaseTimeoutError,
  isRetryableDatabaseError,
  runDatabaseOperation,
} from '@server/modules/databaseRetry'

const FAST_OPTIONS = {
  attempts: 3,
  timeoutMs: 50,
  baseDelayMs: 0,
}

describe('Повторы операций с хранилищем', () => {
  it('повторяет сетевой сбой и возвращает результат удачной попытки', async () => {
    let attempts = 0
    const result = await runDatabaseOperation(async () => {
      attempts += 1
      if (attempts < 3) {
        throw Object.assign(new Error('network'), {
          code: 'network-request-failed',
        })
      }
      return 'ok'
    }, FAST_OPTIONS)

    expect(result).toBe('ok')
    expect(attempts).toBe(3)
  })

  it('не повторяет отказ прав или некорректные данные', async () => {
    let attempts = 0
    await expect(
      runDatabaseOperation(async () => {
        attempts += 1
        throw Object.assign(new Error('denied'), {
          code: 'permission-denied',
        })
      }, FAST_OPTIONS)
    ).rejects.toThrow('denied')

    expect(attempts).toBe(1)
    expect(
      isRetryableDatabaseError(
        Object.assign(new Error('denied'), { code: 'permission-denied' })
      )
    ).toBe(false)
  })

  it('прерывает зависшую операцию по таймауту', async () => {
    await expect(
      runDatabaseOperation(() => new Promise<void>(() => undefined), {
        attempts: 1,
        timeoutMs: 10,
        baseDelayMs: 0,
      })
    ).rejects.toBeInstanceOf(DatabaseTimeoutError)
  })

  it('считает неизвестные ошибки повторяемыми', () => {
    expect(isRetryableDatabaseError(new Error('socket hang up'))).toBe(true)
    expect(isRetryableDatabaseError(new DatabaseTimeoutError(10))).toBe(true)
  })
})
