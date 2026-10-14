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
    expect(warn).toHaveBeenCalledWith('[WARN] [test] visible', error)
  })

  it('uses info when LOG_LEVEL is unknown', () => {
    process.env.LOG_LEVEL = 'verbose'
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const logger = createLogger('test')

    logger.debug('hidden')
    logger.info('visible')

    expect(debug).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledWith('[INFO] [test] visible')
  })

  it('supports silencing all levels', () => {
    process.env.LOG_LEVEL = 'silent'
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    createLogger('test').error('hidden')

    expect(error).not.toHaveBeenCalled()
  })
})
