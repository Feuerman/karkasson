import { describe, expect, it } from 'vitest'
import {
  classifyConnectError,
  describeConnectionStatus,
  type ConnectionSnapshot,
} from '@/modules/connectionStatus'

const base: ConnectionSnapshot = {
  phase: 'connecting',
  isOnline: true,
  reconnectAttempt: 0,
  lastDisconnectReason: null,
  errorCode: null,
}

describe('Состояние подключения клиента', () => {
  it('показывает подключение как успешное', () => {
    const view = describeConnectionStatus({ ...base, phase: 'connected' })

    expect(view).toMatchObject({
      label: 'Подключено',
      tone: 'success',
      overlay: false,
      canRetry: false,
    })
  })

  it('отличает отсутствие интернета от недоступности сервера', () => {
    const offline = describeConnectionStatus({
      ...base,
      phase: 'offline',
      isOnline: false,
      errorCode: 'transport',
    })

    expect(offline.label).toBe('Нет подключения')
    expect(offline.details).toContain('интернет')
    expect(offline.tone).toBe('error')

    const unavailable = describeConnectionStatus({
      ...base,
      phase: 'reconnecting',
      errorCode: 'transport',
    })

    expect(unavailable.label).toBe('Сервер недоступен')
    expect(unavailable.details).toContain('соединение')
    expect(unavailable.tone).toBe('warning')
  })

  it('не показывает полноэкранное состояние во время первой попытки', () => {
    const view = describeConnectionStatus(base)

    expect(view.label).toBe('Подключение…')
    expect(view.overlay).toBe(false)
    expect(view.canRetry).toBe(false)
  })

  it('объясняет закрытие соединения сервером и добавляет номер попытки', () => {
    const view = describeConnectionStatus({
      ...base,
      phase: 'reconnecting',
      lastDisconnectReason: 'io server disconnect',
      reconnectAttempt: 3,
    })

    expect(view.label).toBe('Сервер закрыл соединение')
    expect(view.details).toContain('Попытка 3')
    expect(view.overlay).toBe(true)
    expect(view.canRetry).toBe(true)
  })

  it('показывает таймаут и неизвестную ошибку', () => {
    const timeout = describeConnectionStatus({
      ...base,
      phase: 'reconnecting',
      errorCode: 'timeout',
      reconnectAttempt: 2,
    })
    expect(timeout.label).toBe('Сервер не отвечает')
    expect(timeout.details).toContain('Попытка 2')

    const server = describeConnectionStatus({
      ...base,
      phase: 'reconnecting',
      errorCode: 'server',
    })
    expect(server.label).toBe('Сервер недоступен')

    const unknown = describeConnectionStatus({
      ...base,
      phase: 'reconnecting',
      errorCode: 'unknown',
    })
    expect(unknown.label).toBe('Нет связи с сервером')
  })

  it('сводит технический текст ошибки к категории', () => {
    expect(classifyConnectError('xhr poll error')).toBe('transport')
    expect(classifyConnectError('websocket error')).toBe('transport')
    expect(classifyConnectError('timeout')).toBe('timeout')
    expect(classifyConnectError('server error')).toBe('server')
    expect(classifyConnectError('something unexpected')).toBe('unknown')
  })
})
