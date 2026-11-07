import { createServer, type AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { GameService } from '@/modules/GameService'
import type { GameData } from '@server/services/GameService'
import { registerIntegrationCleanup } from './helpers/cleanup'
import {
  startTestServer,
  startTestServerAtPort,
  type RunningServer,
} from './helpers/server'
import { sleep, waitForCondition } from './helpers/wait'

/**
 * Восстановление связи глазами клиента: бесконечные попытки, ручной retry,
 * холодный старт сервера и повторная привязка сокета к своей партии.
 */
describe('Переподключение клиента', () => {
  let server: RunningServer | undefined
  const services: GameService[] = []

  registerIntegrationCleanup({
    getServer: () => server,
    clearServer: () => {
      server = undefined
    },
    disposeClients: () => {
      for (const service of services) service.disconnect()
      services.length = 0
    },
  })

  async function connectService(running: RunningServer): Promise<GameService> {
    const service = new GameService({ serverUrl: running.url })
    services.push(service)
    service.connect()
    await waitForCondition(
      () => Boolean(service.socket?.connected),
      'клиентский socket не подключился',
      10_000
    )
    await waitForCondition(
      () => service.sessionReady.value,
      'сессия не зарегистрировалась',
      10_000
    )
    return service
  }

  async function createStartedGame(service: GameService): Promise<GameData> {
    await service.createGame()
    await service.addPlayer({ name: 'Alice', index: 0 })
    await service.addPlayer({ name: null, index: 1 })
    return service.startGame()
  }

  async function reservePort(): Promise<number> {
    const probe = createServer()
    await new Promise<void>((resolve, reject) => {
      probe.once('error', reject)
      probe.listen(0, '127.0.0.1', resolve)
    })
    const address = probe.address() as AddressInfo
    await new Promise<void>((resolve) => probe.close(() => resolve()))
    return address.port
  }

  it('сам переподключается и повторно занимает свой слот', async () => {
    server = await startTestServer()
    const client = await connectService(server)
    const game = await createStartedGame(client)
    const socket = client.socket
    const sessionId = client.sessionId.value

    // Обрыв транспорта: Socket.IO должен восстановить соединение сам.
    client.socket?.io.engine?.close?.()
    await waitForCondition(
      () => !client.isConnected.value,
      'сокет не заметил обрыв',
      5_000
    )
    expect(client.connectionPhase.value).toBe('reconnecting')

    await waitForCondition(
      () => client.isConnected.value,
      'сокет не переподключился автоматически',
      15_000
    )
    expect(client.socket).toBe(socket)
    await waitForCondition(
      () => client.sessionReady.value,
      'сессия не восстановилась после переподключения',
      10_000
    )
    await waitForCondition(
      () => {
        const socketId = client.socket?.id
        return Boolean(
          socketId &&
          server?.handle.gameService.getSessionBySocketId(socketId) ===
            sessionId
        )
      },
      'сервер не связал новый сокет с прежней сессией',
      10_000
    )

    const gameId = game.id ?? client.gameId
    expect(gameId).toBeTruthy()
    const rejoined = await client.rejoinGame(gameId)
    expect(rejoined.gameIsStarted).toBe(true)
    const repeated = await client.rejoinGame(gameId)
    expect(repeated.id).toBe(gameId)
  })

  it('не переподключается сам после явного отключения и слушается ручной попытки', async () => {
    server = await startTestServer()
    const client = await connectService(server)

    client.disconnect()
    await waitForCondition(
      () => !client.isConnected.value,
      'сокет не отключился',
      5_000
    )
    await sleep(300)
    expect(client.isConnected.value).toBe(false)

    client.reconnectNow()
    await waitForCondition(
      () => client.isConnected.value,
      'ручное переподключение не сработало',
      10_000
    )
    await waitForCondition(
      () => client.sessionReady.value,
      'сессия не восстановилась после ручного подключения',
      10_000
    )
  })

  it('переживает холодный старт и подключается, когда сервер поднялся', async () => {
    const port = await reservePort()
    const client = new GameService({ serverUrl: `http://127.0.0.1:${port}` })
    services.push(client)
    client.connect()

    await waitForCondition(
      () => client.connectionPhase.value === 'reconnecting',
      'клиент не перешёл в режим ожидания сервера',
      10_000
    )
    await waitForCondition(
      () => client.reconnectAttempt.value > 0,
      'клиент не начал повторные попытки',
      10_000
    )
    expect(client.isConnected.value).toBe(false)

    server = await startTestServerAtPort(port)
    await waitForCondition(
      () => client.isConnected.value,
      'клиент не подключился к поднявшемуся серверу',
      20_000
    )
    await waitForCondition(
      () => client.sessionReady.value,
      'сессия не зарегистрировалась после холодного старта',
      10_000
    )
    await waitForCondition(
      () => {
        const socketId = client.socket?.id
        return Boolean(
          socketId &&
          server?.handle.gameService.getSessionBySocketId(socketId) ===
            client.sessionId.value
        )
      },
      'сервер не связал сокет с сессией после холодного старта',
      10_000
    )
  })
})
