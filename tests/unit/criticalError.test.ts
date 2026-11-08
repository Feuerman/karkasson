import { afterEach, describe, expect, it } from 'vitest'
import {
  criticalError,
  setCriticalError,
  clearCriticalError,
} from '@/modules/criticalError'

afterEach(() => {
  clearCriticalError()
})

describe('criticalError', () => {
  it('хранит сообщение об ошибке после setCriticalError', () => {
    const error = new Error('разрыв соединения')

    setCriticalError(error, 'network_error')

    expect(criticalError.value).toEqual({
      message: 'разрыв соединения',
      code: 'network_error',
    })
  })

  it('сохраняет текст строковых ошибок без кода', () => {
    setCriticalError('просто строка')

    expect(criticalError.value).toEqual({
      message: 'просто строка',
      code: undefined,
    })
  })

  it('очищается вызовом clearCriticalError', () => {
    setCriticalError(new Error('старая'))
    clearCriticalError()

    expect(criticalError.value).toBeNull()
  })
})
