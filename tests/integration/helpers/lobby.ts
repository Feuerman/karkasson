import { SocketEvents } from '@server/modules/types'
import { TestClient } from './client'
import type { TileSnapshot } from './gameplay'

export interface LobbySetup {
  gameId: string
  creator: TestClient
  joiner: TestClient
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

/**
 * Разворачивает лобби с двумя реальными игроками (слоты 0 и 1)
 * и двумя компьютерными (слоты 2 и 3).
 */
export async function createLobbyWithPlayers(
  serverUrl: string
): Promise<LobbySetup> {
  const creator = new TestClient(serverUrl, 'device-creator')
  await creator.connect()
  creator.registerDevice()

  const joiner = new TestClient(serverUrl, 'device-joiner')
  await joiner.connect()
  joiner.registerDevice()

  creator.emit(SocketEvents.CreateGame)
  const created = (await creator.waitForEvent(SocketEvents.GameCreated)) as {
    gameId: string
  }
  const gameId = created.gameId

  // Слот 0 — создатель, реальный игрок
  await creator.emitAck(SocketEvents.AddPlayer, {
    gameId,
    name: 'Alice',
    index: 0,
  })

  // Слот 1 — второй реальный игрок
  joiner.emit(SocketEvents.JoinGame, { gameId })
  await joiner.waitForEvent(SocketEvents.GameUpdated)

  await joiner.emitAck(SocketEvents.AddPlayer, {
    gameId,
    name: 'Bob',
    index: 1,
  })

  // Слоты 2 и 3 — компьютерные игроки (без socketId и deviceId)
  await creator.emitAck(SocketEvents.AddPlayer, {
    gameId,
    name: null,
    index: 2,
  })
  await creator.emitAck(SocketEvents.AddPlayer, {
    gameId,
    name: null,
    index: 3,
  })

  return { gameId, creator, joiner }
}

/** Последний gameUpdated-слепок комнаты (например, после старта игры) */
export async function latestGame(
  client: TestClient,
  predicate: (game: TestGameData) => boolean = () => true
): Promise<TestGameData> {
  return (await client.waitForEvent(
    SocketEvents.GameUpdated,
    predicate as (payload: unknown) => boolean
  )) as TestGameData
}

export function playerIndexByName(game: TestGameData, name: string): number {
  return game.players.findIndex((p) => p.name === name)
}
