import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createLogger, runWithContext } from '@server/utils/logger'

const levels = ['debug', 'info', 'warn', 'error'] as const

function capture() {
  const captured: Array<{ level: string; text: string }> = []
  const spies = levels.map((level) =>
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      captured.push({ level, text: args.map(String).join(' ') })
    })
  )
  return { captured, spies }
}

describe('server logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete process.env.LOG_FORMAT
    delete process.env.LOG_LEVEL
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('выводит текстовый формат по умолчанию', () => {
    const { captured } = capture()
    process.env.NODE_ENV = 'development'
    const log = createLogger('test')
    log.info('привет', { key: 'val' })
    const line = captured.find((c) => c.level === 'info')?.text
    expect(line).toContain('[INFO]')
    expect(line).toContain('[test]')
    expect(line).toContain('привет')
  })

  it('выводит JSON при LOG_FORMAT=json и включает детали', () => {
    const { captured } = capture()
    process.env.LOG_FORMAT = 'json'
    const log = createLogger('test')
    log.error('ошибка', new Error('boom'), { code: 1 })
    const line = captured.find((c) => c.level === 'error')?.text
    expect(line).toBeDefined()
    const record = JSON.parse(line ?? '') as Record<string, unknown>
    expect(record.level).toBe('error')
    expect(record.scope).toBe('test')
    expect(record.msg).toBe('ошибка')
    expect((record.err as { message?: string })?.message).toBe('boom')
    expect(record.code).toBe(1)
  })

  it('распространяет контекст запроса через runWithContext, включая await', async () => {
    const { captured } = capture()
    process.env.LOG_FORMAT = 'json'
    await runWithContext(
      { requestId: 'req-1', gameId: 'game-1' as string },
      async () => {
        const log = createLogger('test')
        log.info('команда', { command: 'move' })
        await new Promise((r) => setTimeout(r, 5))
        log.warn('после await')
      }
    )
    const records = captured.map(
      (c) => JSON.parse(c.text) as Record<string, unknown>
    )
    expect(records.length).toBe(2)
    expect(records.every((r) => r.requestId === 'req-1')).toBe(true)
    expect(records.every((r) => r.gameId === 'game-1')).toBe(true)
    expect(records.some((r) => r.command === 'move')).toBe(true)
    expect(records.some((r) => r.msg === 'после await')).toBe(true)
  })

  it('child-логгер объединяет контекст', () => {
    const { captured } = capture()
    process.env.LOG_FORMAT = 'json'
    const log = createLogger('test').child({ requestId: 'parent' })
    log.info('дочерняя')
    const record = JSON.parse(
      captured.find((c) => c.level === 'info')!.text
    ) as Record<string, unknown>
    expect(record.requestId).toBe('parent')
  })
})
