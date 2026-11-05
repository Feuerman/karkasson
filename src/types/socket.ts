import type { GameSummary, GameData } from '@server/services/GameService'
import type { PlayerId, PlacementConflict, Point } from '@server/modules/types'

export interface SocketAckBase {
  error?: string
  /** Стабильный машинный код отказа; текст может меняться. */
  code?: string
  success?: boolean
  /** Конфликтующие соседние клетки при неудачном размещении тайла. */
  conflicts?: PlacementConflict[]
}

export type SocketAck<T extends object = object> = SocketAckBase & T

/** Ответ игровой команды: подтверждение и состояние партии после хода. */
export interface GameAck extends SocketAckBase {
  game: GameData
}

export interface GamesListResponse {
  games: GameSummary[]
  error?: string
  code?: string
}

export interface GameResponse {
  success?: boolean
  error?: string
  code?: string
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
  point: Point
}

export interface FairyMovePayload {
  gameId: string
  point: Point
}

export interface RemovePlayerPayload {
  gameId: string
  index: number
  /** Освободить сокет, сохранив слот как компьютерного игрока. */
  keepAsComputer: boolean
}

export interface PlayerTemporaryDisconnectedPayload {
  playerIds: PlayerId[]
}
