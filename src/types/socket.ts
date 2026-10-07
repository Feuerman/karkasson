import type { GameSummary, GameData } from '@server/services/GameService'
import type { Player, PlacementConflict } from '@server/modules/types'

export interface SocketAckBase {
  error?: string
  success?: boolean
  /** Конфликтующие соседние клетки при неудачном размещении тайла. */
  conflicts?: PlacementConflict[]
}

export type SocketAck<T extends object = object> = SocketAckBase & T

export interface GamesListResponse {
  games: GameSummary[]
  error?: string
}

export interface GameResponse {
  success?: boolean
  error?: string
  game?: GameData
}

export type EmptyResponse = SocketAckBase

export interface GameCreatedPayload {
  gameId: string
  game: GameData
}

export interface CreateGameResponse extends SocketAckBase {
  gameId: string
  game: GameData
}

export interface DragonMovePayload {
  gameId: string
  position: { rowIndex: number; tileIndex: number }
}

export interface PrincessChoicePayload {
  gameId: string
  cityId: string
  point: import('@server/modules/types').Point
}

export interface PlayerTemporaryDisconnectedPayload {
  deviceId?: string
  playerIds: Player[]
}
