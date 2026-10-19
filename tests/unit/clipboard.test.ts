// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from '@/utils/clipboard'

/**
 * Номер комнаты копируется в буфер обмена. Если браузер не даёт доступа к
 * буферу, используется запасной способ через скрытое поле ввода.
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('copyToClipboard', () => {
  it('копирует текст через буфер обмена', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyToClipboard('482731')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('482731')
  })

  it('при отказе буфера пробует запасной способ', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('нет доступа')),
      },
    })
    document.execCommand = vi.fn().mockReturnValue(true)

    await expect(copyToClipboard('482731')).resolves.toBe(true)
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('без буфера обмена и без команды копирования сообщает об отказе', async () => {
    vi.stubGlobal('navigator', {})
    document.execCommand = vi.fn().mockImplementation(() => {
      throw new Error('команда не поддерживается')
    })

    await expect(copyToClipboard('482731')).resolves.toBe(false)
  })

  it('после копирования не оставляет скрытых полей на странице', async () => {
    vi.stubGlobal('navigator', {})
    document.execCommand = vi.fn().mockReturnValue(true)

    await copyToClipboard('482731')

    expect(document.querySelectorAll('textarea')).toHaveLength(0)
  })
})
