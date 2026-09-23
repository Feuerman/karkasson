import type { GameSummary, GameData } from '@server/services/GameService'
import type { GridTile, ObjectFollower } from '@server/modules/types'

export type IGameBoard = GameData & { isMyTurn: boolean }
export type IGame = GameData
export type LobbyGame = GameSummary & { isLastGame?: boolean }

export interface ITile {
  id: string
  rotation: number
  sides: GridTile['sides']
  x?: number
  y?: number
  rowIndex?: number
  tileIndex?: number
  followers?: ObjectFollower[]
  imgUrl?: string
  name?: string
  description?: string
  isSolidCity?: boolean
  isMonastery?: boolean
  hasGarden?: boolean
  withShield?: boolean
}
