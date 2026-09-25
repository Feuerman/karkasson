import type { GameSummary, GameData } from '@server/services/GameService'
import type { Player } from '@server/modules/types'

export interface SocketAckBase {
  error?: string
  success?: boolean
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

export interface PlacementsResponse {
  error?: string
  placements?: AvailablePlacement[]
}

export interface AvailablePlacement {
  type: 'road' | 'city' | 'monastery' | 'garden'
  side?: string
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

export interface PlayerTemporaryDisconnectedPayload {
  deviceId?: string
  playerIds: Player[]
}
