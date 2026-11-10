import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '@/utils/logger'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('client logger', () => {
  it('writes a scoped message and metadata to the matching console level', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const detail = { reason: 'offline' }

    createLogger('test').warn('Connection issue', detail)

    const [line] = warn.mock.calls[0]
    const record = JSON.parse(line as string)
    expect(record.level).toBe('warn')
    expect(record.scope).toBe('test')
    expect(record.msg).toBe('Connection issue')
    expect(record.reason).toBe('offline')
  })
})
