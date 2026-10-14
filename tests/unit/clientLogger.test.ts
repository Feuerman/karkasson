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

    expect(warn).toHaveBeenCalledWith('[WARN] [test] Connection issue', detail)
  })
})
