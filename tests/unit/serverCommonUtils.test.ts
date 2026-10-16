import { describe, expect, it } from 'vitest'
import { getErrorMessage } from '@server/utils/common'

describe('getErrorMessage', () => {
  it.each([
    [new Error('boom'), 'boom'],
    ['plain', 'plain'],
    [42, '42'],
    [undefined, 'undefined'],
  ])('преобразует %s в сообщение %s', (error, expected) => {
    expect(getErrorMessage(error)).toBe(expected)
  })
})
