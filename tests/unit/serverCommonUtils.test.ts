import { describe, expect, it } from 'vitest'
import { getErrorMessage } from '@server/utils/common'

describe('getErrorMessage', () => {
  it('возвращает message для Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('строкует не-Error значения', () => {
    expect(getErrorMessage('plain')).toBe('plain')
    expect(getErrorMessage(42)).toBe('42')
    expect(getErrorMessage(undefined)).toBe('undefined')
  })
})
