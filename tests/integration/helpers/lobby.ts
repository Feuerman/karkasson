import { SocketEvents } from '@server/modules/types'
import { TestClient, connectTestClient } from './client'
import type { TileSnapshot } from './gameplay'

export interface LobbySetup {
  gameId: string
  creator: TestClient
  joiner: TestClient
  /** id серверных игроков по номеру слота */
  playerIds: number[]
}

/** Правила и дополнения, с которыми сервер создаёт партию */
export interface LobbyRules {
  finalScoringEnabled?: boolean
  innsAndCathedralsEnabled?: boolean
  riverEnabled?: boolean
  princessAndDragonEnabled?: boolean
}

export interface GameSummaryPlayer {
  id: number
  name: string | null
  color: string | null
  socketId: string | null
  deviceId: string | null
}

/** Типизированный слепок данных игры из события server gameUpdated */
export interface TestGameData {
  id: string
  roomCode?: string
  players: GameSummaryPlayer[]
  currentPlayerIndex: number
  currentPlayer?: {
    id: number | string
    name: string | null
    socketId: string | null
    deviceId: string | null
  } | null
  gameIsStarted: boolean
  gameIsEnded: boolean
  gridSize?: number[]
  finalScoringEnabled: boolean
  rules?: {
    finalScoringEnabled: boolean
    expansions: {
      innsAndCathedrals: boolean
      river: boolean
      princessAndDragon: boolean
    }
  }
  moveCounter: number
  scores: Record<string, number>
  tilesList: unknown[]
  currentTile?: TileSnapshot | null
  tilePlacesStats: Record<number, Record<number, TileSnapshot>>
  availablePlacesTiles?: Array<{
    rowIndex: number
    tileIndex: number
  }>
  placingPoint?: { rowIndex: number; tileIndex: number }
  isPlacingFollower?: boolean
}

export interface CreateLobbyOptions {
  /** deviceId создателя лобби (слот 0) */
  deviceId?: string
  /** deviceId второго реального игрока (слот 1) */
  joinerDeviceId?: string
  /** Сколько слотов занимают люди: 1 — создатель, 2 — создатель и вошедший */
  humans?: 1 | 2
  /** Сколько слотов после людей занимают компьютеры (по умолчанию — до четырёх) */
  computers?: number
  /** Партия целиком из компьютеров: создатель освобождает свой слот */
  computerOnly?: boolean
  /** Правила и дополнения партии */
  rules?: LobbyRules
}

export interface CreatedLobby {
  gameId: string
  creator: TestClient
  /** Присоединившийся игрок, если лобби на двоих людей */
  joiner?: TestClient
  /** id серверных игроков по номеру слота */
  playerIds: number[]
}

export interface SingleHumanLobby {
  gameId: string
  creator: TestClient
  aliceId: number
}

/** Имена реальных игроков: слот 0 — создатель, слот 1 — присоединившийся */
const HUMAN_NAMES = ['Alice', 'Bob']

/**
 * Занимает слот лобби: имя задаёт создатель (или сам игрок), а `null`
 * оставляет слот компьютерному игроку — имя выдаёт сервер, socket и
 * device остаются пустыми. Возвращает id занятого игрока.
 */
async function fillSlot(
  client: TestClient,
  gameId: string,
  index: number,
  name: string | null
): Promise<number> {
  const { game } = await client.emitAck<{ game: TestGameData }>(
    SocketEvents.AddPlayer,
    { gameId, name, index }
  )
  const player = game.players[index]
  if (!player) throw new Error(`Слот ${index} лобби не создан`)
  return player.id
}

/**
 * Единая подготовка лобби: создатель создаёт партию, реальные игроки
 * занимают свои слоты, остальные слоты достаются компьютерам.
 *
 * Слот 0 занимает создатель — это делает сервер при создании партии, поэтому
 * хелпер только переименовывает игрока. Второй человек входит в лобби через
 * JoinGame, поэтому сервер сам отдаёт ему первый свободный слот.
 */
export async function createLobby(
  serverUrl: string,
  options: CreateLobbyOptions = {}
): Promise<CreatedLobby> {
  const { computerOnly = false } = options
  const humans = computerOnly ? 0 : (options.humans ?? 1)
  const computers = options.computers ?? 4 - humans

  const creator = await connectTestClient(
    serverUrl,
    options.deviceId ?? 'device-creator'
  )
  creator.emit(SocketEvents.CreateGame, options.rules ?? {})
  const { gameId } = await creator.waitForEvent<{ gameId: string }>(
    SocketEvents.GameCreated
  )

  const playerIds: number[] = []

  if (computerOnly) {
    // Создатель освобождает свой слот: иначе startGame не увидит «все слоты
    // компьютерные» и не запустит автоигру.
    await creator.emitAck(SocketEvents.RemovePlayer, {
      gameId,
      index: 0,
      keepAsComputer: false,
    })
    for (let index = 0; index < computers; index += 1) {
      playerIds[index] = await fillSlot(creator, gameId, index, null)
    }
    return { gameId, creator, playerIds }
  }

  // Слот 0 — создатель, реальный игрок
  playerIds[0] = await fillSlot(creator, gameId, 0, HUMAN_NAMES[0])

  let joiner: TestClient | undefined
  if (humans === 2) {
    joiner = await connectTestClient(
      serverUrl,
      options.joinerDeviceId ?? 'device-joiner'
    )
    await joiner.emitAck(SocketEvents.JoinGame, { gameId })
    playerIds[1] = await fillSlot(joiner, gameId, 1, HUMAN_NAMES[1])
  }

  for (let index = humans; index < humans + computers; index += 1) {
    playerIds[index] = await fillSlot(creator, gameId, index, null)
  }

  return { gameId, creator, joiner, playerIds }
}

/**
 * Разворачивает лобби с двумя реальными игроками (слоты 0 и 1)
 * и двумя компьютерными (слоты 2 и 3).
 */
export async function createLobbyWithPlayers(
  serverUrl: string
): Promise<LobbySetup> {
  const { gameId, creator, joiner, playerIds } = await createLobby(serverUrl, {
    humans: 2,
  })
  if (!joiner) throw new Error('Второй игрок лобби не создан')
  return { gameId, creator, joiner, playerIds }
}

/**
 * Лобби с одним реальным игроком (слот 0) и тремя компьютерными.
 * После хода Алисы очередь всегда переходит компьютерам, поэтому
 * тесту не нужно водить второго человека.
 */
export async function createLobbyWithSingleHuman(
  serverUrl: string
): Promise<SingleHumanLobby> {
  const { gameId, creator, playerIds } = await createLobby(serverUrl, {
    deviceId: 'device-human',
    humans: 1,
  })
  const aliceId = playerIds[0]
  if (aliceId === undefined) throw new Error('Игрок лобби не создан')
  return { gameId, creator, aliceId }
}

/** Последний gameUpdated-слепок комнаты (например, после старта игры) */
export async function latestGame(
  client: TestClient,
  predicate: (game: TestGameData) => boolean = () => true
): Promise<TestGameData> {
  return client.waitForEvent<TestGameData>(SocketEvents.GameUpdated, predicate)
}
