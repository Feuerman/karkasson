import type { IGame, ITile } from './game.js'
import type { Socket } from 'socket.io-client'

export interface IGameService {
  socket: Socket | null
  connect: () => void
  onGameUpdated: (callback: (game: IGame) => void) => void
  onPlayerDisconnected: (callback: () => void) => void
  selectPlacingPoint: (point: { rowIndex: number; tileIndex: number }) => Promise<any>
  updateCurrentTile: (tile: ITile) => Promise<any>
  placeTile: (tile: ITile, position: { rowIndex: number; tileIndex: number }) => Promise<any>
  getGamesList: () => Promise<IGame[]>
  joinGame: (gameId: string) => Promise<IGame>
  leaveGame: () => Promise<void>
  createGame: () => Promise<IGame>
  rejoinGame: (gameId: string) => Promise<IGame>
} 