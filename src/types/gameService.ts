import type { IGame, ITile } from './game'
import type { Socket } from 'socket.io-client'
import type { GameSummary } from '@server/services/GameService'
import type { SocketAck, AvailablePlacement } from './socket'

export interface IGameService {
  socket: Socket | null
  connect: () => void
  onGameUpdated: (callback: (game: IGame) => void) => void
  onPlayerDisconnected: (callback: () => void) => void
  selectPlacingPoint: (point: {
    rowIndex: number
    tileIndex: number
  }) => Promise<SocketAck>
  updateCurrentTile: (tile: ITile) => Promise<SocketAck>
  placeTile: (
    tile: ITile,
    position: { rowIndex: number; tileIndex: number }
  ) => Promise<SocketAck>
  getGamesList: () => Promise<GameSummary[]>
  joinGame: (gameId: string) => Promise<IGame>
  leaveGame: () => Promise<void>
  createGame: () => Promise<IGame>
  rejoinGame: (gameId: string) => Promise<IGame>
  checkAvailablePlacements: (position: {
    row: number
    col: number
  }) => Promise<AvailablePlacement[]>
}
