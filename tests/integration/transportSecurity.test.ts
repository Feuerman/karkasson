import { describe, expect, it } from 'vitest'
import { io } from 'socket.io-client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import { startTestServer, type RunningServer } from './helpers/server'

describe('Транспорт и защита периметра', () => {
  let server: RunningServer | undefined

  registerIntegrationCleanup({
    getServer: () => server,
    clearServer: () => {
      server = undefined
    },
    disposeClients: () => undefined,
  })

  function socketIoHandshakeUrl(url: string): string {
    return `${url}/socket.io/?EIO=4&transport=polling`
  }

  it('принимает handshake с разрешённого Origin и возвращает CORS-заголовок', async () => {
    server = await startTestServer(undefined, {
      clientOrigins: ['https://client.example'],
    })

    const response = await fetch(socketIoHandshakeUrl(server.url), {
      headers: { Origin: 'https://client.example' },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://client.example'
    )
  })

  it('отклоняет polling-handshake с чужого Origin', async () => {
    server = await startTestServer(undefined, {
      clientOrigins: ['https://client.example'],
    })

    const response = await fetch(socketIoHandshakeUrl(server.url), {
      headers: { Origin: 'https://evil.example' },
    })

    expect(response.status).toBe(403)
  })

  it('отклоняет WebSocket-рукопожатие с чужого Origin', async () => {
    server = await startTestServer(undefined, {
      clientOrigins: ['https://client.example'],
    })

    const socket = io(server.url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      extraHeaders: { Origin: 'https://evil.example' },
    })

    try {
      const error = await new Promise<Error>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Таймаут ожидания connect_error')),
          5_000
        )
        socket.once('connect', () => {
          clearTimeout(timer)
          reject(new Error('Ожидался отказ в рукопожатии'))
        })
        socket.once('connect_error', (connectionError: Error) => {
          clearTimeout(timer)
          resolve(connectionError)
        })
      })

      expect(error).toBeInstanceOf(Error)
      expect(socket.connected).toBe(false)
    } finally {
      socket.close()
    }
  })

  it('публичный health минимален, а диагностика закрыта токеном', async () => {
    server = await startTestServer(undefined, {
      diagnosticsToken: 'diagnostics-secret',
    })

    const health = await fetch(`${server.url}/health`)
    expect(health.status).toBe(200)
    expect(await health.json()).toEqual({ status: 'ok' })

    const unauthorized = await fetch(`${server.url}/health/details`)
    expect(unauthorized.status).toBe(401)

    const wrongToken = await fetch(`${server.url}/health/details`, {
      headers: { Authorization: 'Bearer wrong' },
    })
    expect(wrongToken.status).toBe(401)

    const details = await fetch(`${server.url}/health/details`, {
      headers: { Authorization: 'Bearer diagnostics-secret' },
    })
    expect(details.status).toBe(200)
    expect(await details.json()).toMatchObject({
      status: 'ok',
      storage: { unreadableSaves: 0 },
    })
  })

  it('скрывает диагностический endpoint, если токен не настроен', async () => {
    server = await startTestServer(undefined, { diagnosticsToken: null })

    const response = await fetch(`${server.url}/health/details`)
    expect(response.status).toBe(404)
  })

  it('добавляет базовые заголовки безопасности', async () => {
    server = await startTestServer()

    const response = await fetch(`${server.url}/health`)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('permissions-policy')).toContain('camera=()')
    expect(response.headers.get('content-security-policy')).toContain(
      "default-src 'none'"
    )
  })
})
