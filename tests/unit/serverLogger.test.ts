import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '@server/utils/logger'

afterEach(() => {
  delete process.env.LOG_LEVEL
  vi.restoreAllMocks()
})

describe('server logger', () => {
  it('writes scoped messages and metadata at the configured level', () => {
    process.env.LOG_LEVEL = 'warn'
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = new Error('failure')
    const logger = createLogger('test')

    logger.debug('hidden')
    logger.info('hidden')
    logger.warn('visible', error)

    expect(info).not.toHaveBeenCalled()
    const [line] = warn.mock.calls[0]
    const record = JSON.parse(line as string)
    expect(record.level).toBe('warn')
    expect(record.scope).toBe('test')
    expect(record.msg).toBe('visible')
    expect(record.err.message).toBe('failure')
  })

  it('uses info when LOG_LEVEL is unknown', () => {
    process.env.LOG_LEVEL = 'verbose'
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const logger = createLogger('test')

    logger.debug('hidden')
    logger.info('visible')

    expect(debug).not.toHaveBeenCalled()
    const [line] = info.mock.calls[0]
    const record = JSON.parse(line as string)
    expect(record.level).toBe('info')
    expect(record.scope).toBe('test')
    expect(record.msg).toBe('visible')
  })

  it('supports silencing all levels', () => {
    process.env.LOG_LEVEL = 'silent'
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    createLogger('test').error('hidden')

    expect(error).not.toHaveBeenCalled()
  })
})
