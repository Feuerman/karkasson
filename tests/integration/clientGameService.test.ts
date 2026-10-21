import { describe, expect, it } from 'vitest'
import {
  GameService,
  SocketAckError,
  type CreateGameOptions,
} from '@/modules/GameService'
import type { GameData } from '@server/services/GameService'
import type { GameManager } from '@server/modules/GameManager'
import { GameErrors } from '@server/modules/errors'
import { registerIntegrationCleanup } from './helpers/cleanup'
import { PLACEMENT_FAILURE_MESSAGE } from '@server/socket/handlers/placementErrors'
import { SideName, SocketEvents, TileSideType } from '@server/modules/types'
import { usePlayerAsCurrent } from '../helpers/board'
import { boardOf } from '../helpers/fixtures'
import {
  requireInvalidPlacement,
  requireValidPlacement,
} from './helpers/gameplay'
import { startTestServer, type RunningServer } from './helpers/server'
import { waitForCondition } from './helpers/wait'

/**
 * Тесты клиентского приложения: настоящий клиентский GameService
 * (socket.io-client, промисы, обработка ошибок) работает против
 * настоящего тестового сервера.
 */

const DEVICE_TIMEOUT_MS = 10_000
const GAME_UPDATED_TIMEOUT_MS = 20_000

async function waitUntilConnected(service: GameService): Promise<void> {
  await waitForCondition(
    () => Boolean(service.socket?.connected),
    'клиентский socket не подключился',
    DEVICE_TIMEOUT_MS
  )
}

async function waitForServerDevice(
  server: RunningServer,
  service: GameService
): Promise<void> {
  await waitForCondition(
    () => {
      const socketId = service.socket?.id
      return Boolean(
        socketId &&
        server.handle.gameService.getDeviceBySocketId(socketId) ===
          service.deviceId
      )
    },
    `device ${service.deviceId} не зарегистрировался на сервере`,
    DEVICE_TIMEOUT_MS
  )
}

function waitGameUpdated(
  service: GameService,
  predicate: (game: GameData) => boolean,
  timeoutMs = GAME_UPDATED_TIMEOUT_MS
): Promise<GameData> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      service.socket?.off(SocketEvents.GameUpdated, handler)
      reject(new Error('Таймаут ожидания gameUpdated'))
    }, timeoutMs)
    const handler = (game: GameData) => {
      if (predicate(game)) {
        clearTimeout(timer)
        service.socket?.off(SocketEvents.GameUpdated, handler)
        resolve(game)
      }
    }
    service.socket?.on(SocketEvents.GameUpdated, handler)
  })
}

/** Отказ команды: клиент обязан превратить ack с error в SocketAckError. */
async function expectSocketAckError(
  command: Promise<unknown>
): Promise<SocketAckError> {
  const result = await command.catch((error: unknown) => error)
  if (!(result instanceof SocketAckError)) {
    throw new Error(
      `Ожидалась ошибка SocketAckError, получено: ${String(result)}`
    )
  }
  return result
}

/** Заполняет слоты подряд, начиная с fromIndex: слот задаёт права на правку. */
async function addPlayers(
  client: GameService,
  names: Array<string | null>,
  fromIndex = 0
): Promise<void> {
  for (let offset = 0; offset < names.length; offset++) {
    const index = fromIndex + offset
    await client.addPlayer({ name: names[offset], index })
  }
}

/** Партия с Алисой и одним компьютером: создана, заполнена и запущена. */
async function createStartedGame(
  client: GameService,
  options: CreateGameOptions = {}
): Promise<GameData> {
  await client.createGame(options)
  await addPlayers(client, ['Alice', null])
  return client.startGame()
}

/** Доска партии на сервере: состояние проверяется там же, где оно менялось. */
function serverBoard(server: RunningServer, game: GameData): GameManager {
  const board = server.handle.gameService.getGame(game.id ?? '')
  if (!board) throw new Error('Партия не найдена на сервере')
  return board
}

describe('Клиентское приложение (GameService)', () => {
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

  /** Поднимает сервер, если он ещё не запущен, и подключает клиента. */
  async function connectClient(deviceId: string): Promise<GameService> {
    server ??= await startTestServer()
    const client = new GameService({ serverUrl: server.url, deviceId })
    services.push(client)
    client.connect()
    await waitUntilConnected(client)
    await waitForServerDevice(server, client)
    return client
  }

  it('создаёт лобби, добавляет игроков и видит игру в списке', async () => {
    const alice = await connectClient('client-alice')
    expect(localStorage.getItem('deviceId')).toBe('client-alice')

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
    expect(created.rules.expansions).toEqual({
      innsAndCathedrals: true,
      river: true,
      princessAndDragon: true,
    })
    expect(created.playersFollowers[1]?.bigFollowers).toBe(1)
    expect(created.tilesCount).toBe(131)

    await addPlayers(alice, ['Alice'])

    const games = await alice.getGamesList()
    const found = games.find((g) => g.id === alice.gameId)
    expect(found?.players[0].name).toBe('Alice')
  })

  it('снимает подписку gameUpdated по возвращённой функции cleanup', async () => {
    const client = await connectClient('client-listener-cleanup')

    const listener = () => undefined
    const unsubscribe = client.onGameUpdated(listener)

    expect(client.socket?.listeners(SocketEvents.GameUpdated)).toContain(
      listener
    )

    unsubscribe()

    expect(client.socket?.listeners(SocketEvents.GameUpdated)).not.toContain(
      listener
    )
  })

  it('подписки переживают переподключение: сокет не заменяется новым', async () => {
    const client = await connectClient('client-reconnect')

    const updates: GameData[] = []
    client.onGameUpdated((game) => updates.push(game))
    const socket = client.socket
    expect(socket).toBeTruthy()

    // Разрыв и повторный connect: сервис обязан вернуть тот же сокет, иначе
    // подписка осталась бы на отключённом соединении.
    client.disconnect()
    await waitForCondition(
      () => !client.socket?.connected,
      'сокет не отключился'
    )
    client.connect()
    await waitUntilConnected(client)
    expect(client.socket).toBe(socket)
    await waitForServerDevice(server!, client)

    await createStartedGame(client)

    await waitForCondition(
      () => updates.some((update) => update.gameIsStarted === true),
      'обновление партии не пришло после переподключения'
    )
  })

  it('передаёт включённое дополнение в правила, колоду и начатую игру', async () => {
    const client = await connectClient('client-princess-dragon')

    const created = await client.createGame({ princessAndDragonEnabled: true })
    expect(created.rules.expansions.princessAndDragon).toBe(true)
    expect(created.tilesCount).toBe(101)
    // Состав колоды клиенту не отправляется: он нужен только серверу.
    const createdBoard = serverBoard(server!, created)
    expect(createdBoard.tilesList.some(({ id }) => id === 'PAD_A')).toBe(true)

    await addPlayers(client, ['Alice', null])
    const started = await client.startGame()
    expect(started.rules.expansions.princessAndDragon).toBe(true)
    // Стартовый и вытянутый тайлы уже вынуты из колоды.
    expect(started.tilesCount).toBe(created.tilesCount - 2)
    const startedBoard = serverBoard(server!, started)
    const drawnAndDeckIds = [
      ...startedBoard.tilesList.map(({ id }) => id),
      ...(started.currentTile ? [started.currentTile.id] : []),
    ]
    expect(drawnAndDeckIds.some((id) => id.startsWith('PAD_'))).toBe(true)
  })

  it('применяет выбор фишки принцессы и штраф её тайла', async () => {
    const client = await connectClient('client-princess-choice')
    const game = await createStartedGame(client, {
      princessAndDragonEnabled: true,
    })

    const board = serverBoard(server!, game)
    const playerId = board.players[0].id
    const point = {
      x: 15,
      y: 14,
      direction: SideName.South,
      pointType: TileSideType.City,
    }
    const city = {
      id: 'protocol-princess-city',
      points: [point],
      followers: [{ playerId, objectId: 'protocol-princess-city', point }],
    }
    board.temporaryObjects.cities = [city]
    board.placedFollowers = [{ playerId, objectId: city.id, point }]
    board.princessChoice = { followers: [{ cityId: city.id, point }] }

    const ack = await client.choosePrincessFollower(city.id, point)
    expect(ack.success).toBe(true)
    expect(board.temporaryObjects.cities[0]?.followers).toHaveLength(0)
    // Способность применена: штраф запрещает фишку на этом тайле и переживает
    // откат хода, пока игрок не завершит ход.
    expect(board.princessFollowerPenalty).toBe(true)
    expect(board.availableFollowersPlaces).toHaveLength(0)

    usePlayerAsCurrent(board, 0)
    board.skipFollower()
    expect(board.princessFollowerPenalty).toBe(false)
  })

  it('передаёт серверу ход дракона на соседний тайл', async () => {
    const client = await connectClient('client-dragon-move')
    const game = await createStartedGame(client, {
      princessAndDragonEnabled: true,
    })

    const board = serverBoard(server!, game)
    board.tilesList = []
    board.dragonPosition = { rowIndex: 10, tileIndex: 10 }
    board.dragonMove = {
      remainingSteps: 2,
      nextPlayerIndex: 0,
      resumePlayerIndex: 0,
      visited: [{ rowIndex: 10, tileIndex: 10 }],
    }
    board.tilePlacesStats = boardOf([
      [10, 10, { id: 'dragon-origin' }],
      [10, 11, { id: 'dragon-destination' }],
    ])

    const ack = await client.moveDragon({ rowIndex: 10, tileIndex: 11 })
    expect(ack.success).toBe(true)
    expect(board.dragonPosition).toEqual({ rowIndex: 10, tileIndex: 11 })
  })

  it('играет ход через клиентский сервис и получает отказ вне очереди', async () => {
    const alice = await connectClient('client-alice')
    const bob = await connectClient('client-bob')

    // Лобби: Алиса создаёт, Боб присоединяется, добавляем компьютерных
    await alice.createGame()
    await addPlayers(alice, ['Alice'])
    await bob.joinGame(alice.gameId, 'Bob')
    await addPlayers(bob, ['Bob'], 1)
    // Компьютерные слоты добавляет создатель лобби.
    await addPlayers(alice, [null, null], 2)

    // Старт игры: ожидание регистрируется до команды, иначе gameUpdated
    // успевает прийти до установки слушателя
    const startedPromise = waitGameUpdated(
      alice,
      (game) =>
        game.gameIsStarted === true && game.currentPlayer?.name === 'Alice'
    )
    await alice.startGame()
    const started = await startedPromise
    expect(started.currentPlayer?.id).toBe(started.players[0].id)

    const move = requireValidPlacement(started)
    const invalid = requireInvalidPlacement(started)

    // Невозможное размещение: сервис отклоняет SocketAckError с конфликтами
    const failure = await expectSocketAckError(
      alice.placeTile(invalid.tile, {
        rowIndex: invalid.rowIndex,
        tileIndex: invalid.tileIndex,
      })
    )
    expect(failure.message).toContain(PLACEMENT_FAILURE_MESSAGE)
    expect(failure.conflicts.length).toBeGreaterThan(0)
    expect(failure.conflicts[0]?.side).toBeTruthy()

    const rotated = await alice.setCurrentTileRotation(move.tile.rotation)
    expect(rotated.success).toBe(true)

    const placed = await alice.placeTile(move.tile, {
      rowIndex: move.rowIndex,
      tileIndex: move.tileIndex,
    })
    expect(placed.success).toBe(true)

    if (placed.game.isPlacingFollower) {
      const skipped = await alice.skipFollower()
      expect(skipped.success).toBe(true)
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
      alice.placeTile(move.tile, {
        rowIndex: move.rowIndex,
        tileIndex: move.tileIndex,
      })
    ).rejects.toThrow(GameErrors.NotPlayersTurn)
  })

  it('возвращает причину отказа по реке и подсветку открытого конца', async () => {
    const client = await connectClient('client-river-conflict')

    const started = await createStartedGame(client, { riverEnabled: true })
    expect(started.rules.expansions.river).toBe(true)
    const tile = started.currentTile
    if (!tile) throw new Error('Ожидался речной тайл')

    // Клетка (15,16) не примыкает к единственному открытому концу русла
    // стартового истока в (15,15), поэтому отказ должен быть про реку.
    const failure = await expectSocketAckError(
      client.placeTile(tile, { rowIndex: 15, tileIndex: 16 })
    )
    expect(failure.message).toContain(PLACEMENT_FAILURE_MESSAGE)
    expect(failure.message).toContain('река')
    expect(failure.message).toContain('незакрытый конец')
    expect(failure.conflicts).toEqual([
      { reason: 'openEnd', rowIndex: 15, tileIndex: 15, side: SideName.South },
    ])
  })

  it('отклоняет висящую команду при разрыве соединения', async () => {
    const client = await connectClient('client-disconnect')

    // Сервер не знает этого события и не ответит на него: без явной отмены
    // промис висел бы до пятнадцатисекундного таймаута.
    const unacknowledged = (
      client as unknown as {
        emitAck: (event: string) => Promise<unknown>
      }
    ).emitAck('unknown:command')

    client.socket?.disconnect()

    await expect(unacknowledged).rejects.toThrow(
      'Соединение с сервером прервано'
    )
  })
})
