import { describe, expect, it } from 'vitest'
import { CommonErrors, LobbyErrors } from '@server/modules/errors'
import { SocketEvents } from '@server/modules/types'
import { connectTestClient, TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import { createLobby, type TestGameData } from './helpers/lobby'
import { startTestServer, type RunningServer } from './helpers/server'

describe('Защита от злоупотреблений', () => {
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

  async function connect(identity: string): Promise<TestClient> {
    if (!server) throw new Error('Тестовый сервер не запущен')
    const client = await connectTestClient(server.url, identity)
    clients.push(client)
    return client
  }

  it('отклоняет payload неверной формы и слишком длинный токен', async () => {
    server = await startTestServer()
    const client = await connect('abuse-malformed')

    await expect(
      client.emitAck(SocketEvents.CreateGame, { riverEnabled: 'yes' })
    ).rejects.toThrow(LobbyErrors.InvalidRiverOption)
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
    await expect(
      client.emitAck(SocketEvents.RegisterSession, {
        token: 'a'.repeat(513),
      })
    ).rejects.toThrow(CommonErrors.InvalidRequest)
  })

  it('нормализует имена и не пропускает дубликаты и запрещённые имена', async () => {
    server = await startTestServer()
    const creator = await connect('abuse-names')
    const { gameId } = await creator.emitAck<{ gameId: string }>(
      SocketEvents.CreateGame,
      {}
    )

    await expect(
      creator.emitAck(SocketEvents.AddPlayer, {
        gameId,
        index: 1,
        name: 'я'.repeat(25),
      })
    ).rejects.toThrow(LobbyErrors.PlayerNameTooLong)
    await expect(
      creator.emitAck(SocketEvents.AddPlayer, {
        gameId,
        index: 1,
        name: 'Alice\u0000',
      })
    ).rejects.toThrow(LobbyErrors.PlayerNameInvalid)
    await expect(
      creator.emitAck(SocketEvents.AddPlayer, {
        gameId,
        index: 1,
        name: 'fuck this',
      })
    ).rejects.toThrow(LobbyErrors.PlayerNameProfanity)

    const added = await creator.emitAck<{ game: TestGameData }>(
      SocketEvents.AddPlayer,
      { gameId, index: 1, name: '  Alice   Smith  ' }
    )
    expect(added.game.players[1]?.name).toBe('Alice Smith')

    await creator.emitAck(SocketEvents.AddPlayer, {
      gameId,
      index: 2,
      name: 'Bob',
    })
    await expect(
      creator.emitAck(SocketEvents.AddPlayer, {
        gameId,
        index: 3,
        name: 'bob',
      })
    ).rejects.toThrow(LobbyErrors.PlayerNameTaken)
  })

  it('ограничивает число лобби на сессию', async () => {
    server = await startTestServer(undefined, {
      gameLimits: { maxOwnedLobbies: 1 },
    })
    const creator = await connect('abuse-owned')
    await creator.emitAck(SocketEvents.CreateGame, {})
    await expect(creator.emitAck(SocketEvents.CreateGame, {})).rejects.toThrow(
      LobbyErrors.TooManyOwnedLobbies
    )
  })

  it('ограничивает общее число лобби на сервере', async () => {
    server = await startTestServer(undefined, {
      gameLimits: { maxTotalGames: 1, maxOwnedLobbies: 10 },
    })
    const first = await connect('abuse-total-1')
    const second = await connect('abuse-total-2')
    await first.emitAck(SocketEvents.CreateGame, {})
    await expect(second.emitAck(SocketEvents.CreateGame, {})).rejects.toThrow(
      LobbyErrors.TooManyGames
    )
  })

  it('ограничивает число одновременных партий с компьютерами', async () => {
    server = await startTestServer(undefined, {
      gameLimits: { maxActiveAiGames: 1, maxActiveAiGamesPerSession: 10 },
    })
    const first = await createLobby(server.url, {
      identity: 'abuse-ai-1',
      computerOnly: true,
    })
    clients.push(first.creator)
    await first.creator.emitAck(SocketEvents.StartGame, {
      gameId: first.gameId,
    })

    const second = await createLobby(server.url, {
      identity: 'abuse-ai-2',
      computerOnly: true,
    })
    clients.push(second.creator)
    await expect(
      second.creator.emitAck(SocketEvents.StartGame, { gameId: second.gameId })
    ).rejects.toThrow(LobbyErrors.TooManyAiGames)
  })

  it('ограничивает частоту команд', async () => {
    server = await startTestServer(undefined, {
      abuseGuard: {
        commandBurst: 2,
        commandRefillPerSecond: 0,
        ipCommandBurst: 100,
      },
    })
    const client = await connect('abuse-rate')
    await client.emitAck(SocketEvents.GetGamesList)
    await expect(client.emitAck(SocketEvents.GetGamesList)).rejects.toThrow(
      CommonErrors.TooManyRequests
    )
  })

  it('блокирует перебор кода комнаты после серии неудач', async () => {
    server = await startTestServer(undefined, {
      abuseGuard: {
        joinAttemptWindowMs: 10_000,
        joinDelayThreshold: 1,
        joinDelayStepMs: 0,
        joinDelayMaxMs: 0,
        joinBlockThreshold: 2,
        joinBlockMs: 10_000,
      },
    })
    const client = await connect('abuse-bruteforce')

    await expect(
      client.emitAck(SocketEvents.JoinGame, { gameId: '000000' })
    ).rejects.toThrow(CommonErrors.GameNotFound)
    await expect(
      client.emitAck(SocketEvents.JoinGame, { gameId: '000001' })
    ).rejects.toThrow(CommonErrors.JoinAttemptsExceeded)
  })

  it('не принимает больше сокетов с одного IP, чем разрешено', async () => {
    server = await startTestServer(undefined, {
      abuseGuard: { maxSocketsPerIp: 1 },
    })
    await connect('abuse-socket-1')

    const extra = new TestClient(server.url, 'abuse-socket-2')
    clients.push(extra)
    await expect(extra.connect()).rejects.toThrow(
      CommonErrors.TooManyConnections
    )
  })
})
