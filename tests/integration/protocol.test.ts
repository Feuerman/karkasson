import { describe, expect, it } from 'vitest'
import { CommonErrors } from '@server/modules/errors'
import { PROTOCOL_VERSION, SocketEvents } from '@server/modules/types'
import { TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import { startTestServer, type RunningServer } from './helpers/server'

describe('Протокол и версии', () => {
  let server: RunningServer | undefined
  const clients: TestClient[] = []

  registerIntegrationCleanup({
    getServer: () => server,
    clearServer: () => {
      server = undefined
    },
    disposeClients: () => {
      for (const client of clients) client.dispose()
      clients.length = 0
    },
  })

  async function connect(
    identity: string
  ): Promise<TestClient & { token: string }> {
    if (!server) throw new Error('Тестовый сервер не запущен')
    const client = new TestClient(server.url, identity)
    clients.push(client)
    await client.connect()
    const { token } = await client.registerSession()
    return Object.assign(client, { token })
  }

  it('RegisterSession возвращает версию протокола сервера', async () => {
    server = await startTestServer()
    const client = await connect('protocol-version')

    const response = await client.emitAck<{
      protocolVersion: string
      sessionId: string
    }>(SocketEvents.RegisterSession, { token: client.token })

    expect(response.protocolVersion).toBe(PROTOCOL_VERSION)
    expect(response.sessionId).toBe(client.sessionId)
  })

  it('принимает переданный клиентом protocolVersion и отдаёт свой', async () => {
    server = await startTestServer()
    const client = new TestClient(server.url, 'protocol-client-version')
    clients.push(client)
    await client.connect()
    const { token } = await client.registerSession()

    // Повторная регистрация с чужой версией протокола: сервер отдаёт свою.
    const response = await client.emitAck<{
      protocolVersion: string
    }>(SocketEvents.RegisterSession, {
      token,
      protocolVersion: '0',
    })

    expect(response.protocolVersion).toBe(PROTOCOL_VERSION)
  })

  it('неизвестное событие не падает сервер и не разрывает соединение', async () => {
    server = await startTestServer()
    const client = await connect('protocol-unknown-event')

    const before = client.connected()

    // Эмитируем событие, которого сервер не регистрировал.
    client.socket.emit('completelyUnknownEvent', { foo: 'bar' })

    // Даём серверу время на обработку.
    await new Promise((resolve) => setTimeout(resolve, 500))

    expect(client.connected()).toBe(before)
    // Соединение живо: повторный RegisterSession проходит.
    await expect(
      client.emitAck(SocketEvents.RegisterSession, { token: client.token })
    ).resolves.toBeDefined()
  })

  it('payload неверной формы даёт InvalidRequest и не меняет состояние', async () => {
    server = await startTestServer()
    const client = await connect('protocol-malformed')

    await expect(client.emitAck(SocketEvents.JoinGame, null)).rejects.toThrow(
      CommonErrors.InvalidRequest
    )

    await expect(
      client.emitAck(SocketEvents.AddPlayer, {
        gameId: 'game',
        index: 99,
        name: 'Alice',
      })
    ).rejects.toThrow(CommonErrors.InvalidRequest)

    await expect(
      client.emitAck(SocketEvents.PlaceTile, {
        gameId: 'game',
        position: { rowIndex: 30, tileIndex: 0 },
        rotation: 0,
      })
    ).rejects.toThrow(CommonErrors.InvalidRequest)

    // Соединение остаётся живым после некорректных запросов.
    await expect(
      client.emitAck(SocketEvents.GetGamesList)
    ).resolves.toBeDefined()
  })
})
