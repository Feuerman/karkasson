import { TestClient } from './client'

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
  moveCounter: number
  scores: Record<string, number>
  tilesList: unknown[]
  currentTile?: unknown
  tilePlacesStats: Record<number, Record<number, unknown>>
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

  creator.emit('createGame')
  const created = (await creator.waitForEvent('gameCreated')) as {
    gameId: string
  }
  const gameId = created.gameId

  // Слот 0 — создатель, реальный игрок
  await creator.emitAck('addPlayer', { gameId, name: 'Alice', index: 0 })

  // Слот 1 — второй реальный игрок
  joiner.emit('joinGame', { gameId })
  await joiner.waitForEvent('gameUpdated')

  await joiner.emitAck('addPlayer', { gameId, name: 'Bob', index: 1 })

  // Слоты 2 и 3 — компьютерные игроки (без socketId и deviceId)
  await creator.emitAck('addPlayer', { gameId, name: null, index: 2 })
  await creator.emitAck('addPlayer', { gameId, name: null, index: 3 })

  return { gameId, creator, joiner }
}

/** Последний gameUpdated-слепок комнаты (например, после старта игры) */
export async function latestGame(
  client: TestClient,
  predicate: (game: TestGameData) => boolean = () => true
): Promise<TestGameData> {
  return (await client.waitForEvent(
    'gameUpdated',
    predicate as (payload: unknown) => boolean
  )) as TestGameData
}

export function playerIndexByName(game: TestGameData, name: string): number {
  return game.players.findIndex((p) => p.name === name)
}
