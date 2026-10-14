import type { GameSummary, GameData } from '@server/services/GameService'

export type IGameBoard = GameData & { isMyTurn: boolean }
export type IGame = GameData
export type LobbyGame = GameSummary & { isLastGame?: boolean }
export type BoardCell = { rowIndex?: number; tileIndex?: number }
