import { afterEach, describe, expect, it } from 'vitest'
import { GameService, SocketAckError } from '@/modules/GameService'
import { SideName, TileSideType } from '@server/modules/types'
import {
  findValidPlacement,
  isValidPosition,
  rotateSides,
  type GameStateSnapshot,
  type TileSnapshot,
} from './helpers/gameplay'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'

/**
 * Тесты клиентского приложения: настоящий клиентский GameService
 * (socket.io-client, промисы, обработка ошибок) работает против
 * настоящего тестового сервера.
 */

type AnyGame = Record<string, unknown> & {
  gameIsStarted?: boolean
  gameIsEnded?: boolean
  currentPlayer?: { id: number | string; name: string | null } | null
  isPlacingFollower?: boolean
  currentTile?: { sides: Record<string, string> } | null
  availablePlacesTiles?: Array<{ rowIndex: number; tileIndex: number }>
  tilePlacesStats?: Record<number, Record<number, unknown>>
  game?: { isPlacingFollower?: boolean }
  players: Array<{ id: number | string; name: string | null }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitUntilConnected(service: GameService): Promise<void> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (service.socket?.connected) return
    await sleep(50)
  }
  throw new Error('Клиентский socket не подключился')
}

async function waitForServerDevice(
  server: RunningServer,
  service: GameService
): Promise<void> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const socketId = service.socket?.id
    if (
      socketId &&
      server.handle.gameService.getDeviceBySocketId(socketId) ===
        service.deviceId
    ) {
      return
    }
    await sleep(50)
  }
  throw new Error(`device ${service.deviceId} не зарегистрировался на сервере`)
}

function waitGameUpdated(
  service: GameService,
  predicate: (game: AnyGame) => boolean,
  timeoutMs = 20_000
): Promise<AnyGame> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      service.socket?.off('gameUpdated', handler)
      reject(new Error('Таймаут ожидания gameUpdated'))
    }, timeoutMs)
    const handler = (game: AnyGame) => {
      if (predicate(game)) {
        clearTimeout(timer)
        service.socket?.off('gameUpdated', handler)
        resolve(game)
      }
    }
    service.socket?.on('gameUpdated', handler)
  })
}

/** Поворот и позиция, при которых стороны текущего тайла не сходятся */
function findInvalidPlacement(state: GameStateSnapshot): {
  tile: TileSnapshot
  place: { rowIndex: number; tileIndex: number }
} | null {
  const tile = state.currentTile ?? null
  if (!tile?.sides) return null

  for (const place of state.availablePlacesTiles ?? []) {
    for (let rotation = 1; rotation < 4; rotation++) {
      const sides = rotateSides(tile.sides, rotation)
      if (!isValidPosition(state, sides, place.rowIndex, place.tileIndex)) {
        return {
          tile: {
            ...tile,
            sides,
            rotation: (tile.rotation + rotation * 90) % 360,
          },
          place: { rowIndex: place.rowIndex, tileIndex: place.tileIndex },
        }
      }
    }
  }
  return null
}

describe('Клиентское приложение (GameService)', () => {
  let server: RunningServer | undefined
  const services: GameService[] = []

  afterEach(async () => {
    for (const service of services) service.disconnect()
    services.length = 0
    if (server) {
      await stopTestServer(server)
      server = undefined
    }
  })

  it('создаёт лобби, добавляет игроков и видит игру в списке', async () => {
    server = await startTestServer()
    const alice = new GameService({
      serverUrl: server.url,
      deviceId: 'client-alice',
    })
    services.push(alice)
    expect(localStorage.getItem('deviceId')).toBe('client-alice')

    alice.connect()
    await waitUntilConnected(alice)
    await waitForServerDevice(server, alice)

    const created = await alice.createGame({
      finalScoringEnabled: true,
      innsAndCathedralsEnabled: true,
      riverEnabled: true,
      princessAndDragonEnabled: true,
    })
    expect(alice.gameId).toBeTruthy()
    expect(created.id).toBe(alice.gameId)
    expect(created.gridSize).toEqual([30, 30])
    expect(created.finalScoringEnabled).toBe(true)
    expect(created.rules.expansions.innsAndCathedrals).toBe(true)
    expect(created.rules.expansions.river).toBe(true)
    expect(created.rules.expansions.princessAndDragon).toBe(true)
    expect(created.playersFollowers[1]?.bigFollowers).toBe(1)
    expect(created.tilesList).toHaveLength(131)

    await alice.addPlayer({ name: 'Alice', index: 0 })

    const games = (await alice.getGamesList()) as Array<{
      id: string
      players: Array<{ name: string | null }>
    }>
    const found = games.find((g) => g.id === alice.gameId)
    expect(found).toBeTruthy()
    expect(found!.players[0].name).toBe('Alice')
  })

  it('снимает подписку gameUpdated по возвращённой функции cleanup', async () => {
    server = await startTestServer()
    const client = new GameService({
      serverUrl: server.url,
      deviceId: 'client-listener-cleanup',
    })
    services.push(client)

    client.connect()
    await waitUntilConnected(client)

    const listener = () => undefined
    const unsubscribe = client.onGameUpdated(listener)

    expect(client.socket?.listeners('gameUpdated')).toContain(listener)

    unsubscribe()

    expect(client.socket?.listeners('gameUpdated')).not.toContain(listener)
  })

  it('передаёт выбор включённого дополнения в правила и колоду партии', async () => {
    server = await startTestServer()
    const client = new GameService({
      serverUrl: server.url,
      deviceId: 'client-princess-dragon',
    })
    services.push(client)
    client.connect()
    await waitUntilConnected(client)
    await waitForServerDevice(server, client)

    const game = await client.createGame({ princessAndDragonEnabled: true })

    expect(game.rules.expansions.princessAndDragon).toBe(true)
    expect(game.tilesList).toHaveLength(101)
    expect(game.tilesList.some(({ id }) => id === 'PAD_A')).toBe(true)
  })

  it('передаёт включённое дополнение в начатую игру через GameService', async () => {
    server = await startTestServer()
    const client = new GameService({
      serverUrl: server.url,
      deviceId: 'client-princess-choice',
    })
    services.push(client)
    client.connect()
    await waitUntilConnected(client)
    await waitForServerDevice(server, client)
    const game = await client.createGame({ princessAndDragonEnabled: true })
    await client.addPlayer({ name: 'Alice', index: 0 })
    await client.addPlayer({ name: null, index: 1 })
    const started = await client.startGame()
    expect(started.rules.expansions.princessAndDragon).toBe(true)
    expect(started.tilesList.some(({ id }) => id === 'PAD_A')).toBe(true)

    const serverGame = server.handle.gameService.getGame(game.id ?? '')
    expect(serverGame).toBeTruthy()
    if (!serverGame) return

    const point = {
      x: 15,
      y: 14,
      direction: SideName.South,
      pointType: TileSideType.City,
    }
    const city = {
      id: 'protocol-princess-city',
      points: [point],
      followers: [
        {
          playerId: serverGame.players[0]?.id ?? 1,
          objectId: 'protocol-princess-city',
          point,
        },
      ],
    }
    serverGame.temporaryObjects.cities = [city]
    serverGame.placedFollowers = [
      {
        playerId: serverGame.players[0]?.id ?? 1,
        objectId: city.id,
        point,
      },
    ]
    serverGame.princessChoice = {
      followers: [{ cityId: city.id, point }],
    }
    await client.choosePrincessFollower(city.id, point)
    expect(serverGame.temporaryObjects.cities[0]?.followers).toHaveLength(0)

    serverGame.currentPlayerIndex = 0
    serverGame.currentPlayer = serverGame.players[0] ?? null
    serverGame.tilesList = []
    serverGame.dragonPosition = { rowIndex: 10, tileIndex: 10 }
    serverGame.dragonMove = {
      remainingSteps: 2,
      nextPlayerIndex: 0,
      resumePlayerIndex: 0,
      visited: [{ rowIndex: 10, tileIndex: 10 }],
    }
    serverGame.tilePlacesStats = {
      10: {
        10: {
          id: 'dragon-origin',
          rotation: 0,
          x: 10,
          y: 10,
          sides: {
            north: TileSideType.Field,
            east: TileSideType.Field,
            south: TileSideType.Field,
            west: TileSideType.Field,
          },
        },
        11: {
          id: 'dragon-destination',
          rotation: 0,
          x: 11,
          y: 10,
          sides: {
            north: TileSideType.Field,
            east: TileSideType.Field,
            south: TileSideType.Field,
            west: TileSideType.Field,
          },
        },
      },
    }
    await client.moveDragon({ rowIndex: 10, tileIndex: 11 })
    expect(serverGame.dragonPosition).toEqual({ rowIndex: 10, tileIndex: 11 })
  })

  it('играет ход через клиентский сервис и получает отказ вне очереди', async () => {
    server = await startTestServer()
    const alice = new GameService({
      serverUrl: server.url,
      deviceId: 'client-alice',
    })
    const bob = new GameService({
      serverUrl: server.url,
      deviceId: 'client-bob',
    })
    services.push(alice, bob)

    alice.connect()
    bob.connect()
    await waitUntilConnected(alice)
    await waitUntilConnected(bob)
    await waitForServerDevice(server, alice)
    await waitForServerDevice(server, bob)

    // Лобби: Алиса создаёт, Боб присоединяется, добавляем компьютерных
    await alice.createGame()
    await alice.addPlayer({ name: 'Alice', index: 0 })
    await bob.joinGame(alice.gameId, 'Bob')
    await bob.addPlayer({ name: 'Bob', index: 1 })
    await alice.addPlayer({ name: null, index: 2 })
    await alice.addPlayer({ name: null, index: 3 })

    // Старт игры
    alice.startGame()
    const started = await waitGameUpdated(
      alice,
      (game) =>
        game.gameIsStarted === true && game.currentPlayer?.name === 'Alice'
    )
    expect(started.currentPlayer?.id).toBe(started.players[0].id)

    // Ход Алисы через клиентские методы
    const move = findValidPlacement(started as unknown as GameStateSnapshot)
    expect(move).not.toBeNull()

    // Невозможное размещение: сервис отклоняет SocketAckError с конфликтами
    const invalid = findInvalidPlacement(
      started as unknown as GameStateSnapshot
    )
    expect(invalid).not.toBeNull()
    if (!invalid) return

    const failure = await alice
      .placeTile(invalid.tile, {
        rowIndex: invalid.place.rowIndex,
        tileIndex: invalid.place.tileIndex,
      })
      .catch((error: unknown) => error)

    if (!(failure instanceof SocketAckError)) {
      throw new Error('Ожидалась ошибка SocketAckError')
    }
    expect(failure.message).toContain(
      'Невозможно разместить тайл на данной позиции'
    )
    expect(failure.conflicts.length).toBeGreaterThan(0)
    expect(failure.conflicts[0]?.side).toBeTruthy()

    const updated = await alice.setCurrentTileRotation(move!.tile.rotation)
    expect(updated).toMatchObject({ success: true })

    const placed = await alice.placeTile(move!.tile, {
      rowIndex: move!.rowIndex,
      tileIndex: move!.tileIndex,
    })
    expect(placed).toMatchObject({ success: true })

    if ((placed as AnyGame).game?.isPlacingFollower) {
      const skipped = await alice.skipFollower()
      expect(skipped).toMatchObject({ success: true })
    }

    // Очередь перешла к Бобу (видно и у Алисы, и у Боба)
    const bobTurn = await waitGameUpdated(
      bob,
      (game) =>
        game.currentPlayer?.name === 'Bob' && game.isPlacingFollower !== true
    )
    expect(bobTurn.currentPlayer?.id).toBe(bobTurn.players[1].id)

    // Алиса пробует ходить на ходу Боба — сервис отклоняет промис
    await expect(
      alice.placeTile(move!.tile, {
        rowIndex: move!.rowIndex,
        tileIndex: move!.tileIndex,
      })
    ).rejects.toThrow("Not player's turn")
  })

  it('возвращает причину отказа по реке и подсветку открытого конца', async () => {
    server = await startTestServer()
    const client = new GameService({
      serverUrl: server.url,
      deviceId: 'client-river-conflict',
    })
    services.push(client)
    client.connect()
    await waitUntilConnected(client)
    await waitForServerDevice(server, client)

    await client.createGame({ riverEnabled: true })
    await client.addPlayer({ name: 'Alice', index: 0 })
    await client.addPlayer({ name: null, index: 1 })
    const started = await client.startGame()
    expect(started.rules.expansions.river).toBe(true)
    const tile = started.currentTile
    if (!tile) throw new Error('Ожидался речной тайл')

    // Клетка (15,16) не примыкает к единственному открытому концу русла
    // стартового истока в (15,15), поэтому отказ должен быть про реку.
    const failure = await client
      .placeTile(tile, { rowIndex: 15, tileIndex: 16 })
      .catch((error: unknown) => error)

    if (!(failure instanceof SocketAckError)) {
      throw new Error('Ожидалась ошибка SocketAckError')
    }
    expect(failure.message).toContain(
      'Невозможно разместить тайл на данной позиции'
    )
    expect(failure.message).toContain('река')
    expect(failure.message).toContain('незакрытый конец')
    expect(failure.conflicts).toEqual([
      { reason: 'openEnd', rowIndex: 15, tileIndex: 15, side: SideName.South },
    ])
  })
})
