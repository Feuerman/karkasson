import { io, type Socket } from 'socket.io-client'
import { ref } from 'vue'
import type { AvailableFollowerPlace } from '@server/modules/GameManager'
import type { GameSummary, GameData } from '@server/services/GameService'
import type { GridTile, Tile } from '@server/modules/types'
import type { SocketAck, AvailablePlacement } from '@/types/socket'

export interface IGameService {
  socket: Socket | null
  gameId: string
  deviceId: string
  connect: () => void
  disconnect: () => void
  createGame: () => Promise<GameData>
  joinGame: (gameId: string, playerName?: string) => Promise<GameData>
}

export interface GameServiceOptions {
  serverUrl?: string
  deviceId?: string
}

// Адрес сервера переопределяется через VITE_SERVER_URL (локальная разработка/тесты)
const DEFAULT_SERVER_URL =
  import.meta.env.VITE_SERVER_URL || 'https://karkasson.onrender.com'

export class GameService implements IGameService {
  socket: Socket | null
  gameId: string
  deviceId: string
  gamesList: GameSummary[] = []
  isConnected = ref(false)
  private serverUrl: string

  constructor(options: GameServiceOptions = {}) {
    this.socket = null
    this.gameId = ''
    this.gamesList = []
    this.serverUrl = options.serverUrl ?? DEFAULT_SERVER_URL
    this.deviceId =
      options.deviceId ??
      localStorage.getItem('deviceId') ??
      crypto.randomUUID()
    localStorage.setItem('deviceId', this.deviceId)
  }

  connect() {
    console.log('Attempting to connect to server...')
    if (this.socket?.connected) {
      console.log('Socket already connected, skipping connection')
      return
    }

    const SERVER_URL = this.serverUrl
    const isSecure = SERVER_URL.startsWith('https')
    this.socket = io(SERVER_URL, {
      secure: isSecure,
      rejectUnauthorized: isSecure,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      forceNew: false,
    })

    this.socket.on('connect', () => {
      console.log('Connected to server')
      this.isConnected.value = true
      this.socket?.emit('registerDevice', { deviceId: this.deviceId })
    })

    this.socket.on('disconnect', (reason: string) => {
      console.log('Disconnected from server:', reason)
      this.isConnected.value = false
      if (
        reason === 'io server disconnect' ||
        reason === 'io client disconnect'
      ) {
        console.log('Attempting to reconnect after disconnect...')
        this.socket?.connect()
      }
    })

    this.socket.on('connect_error', (error: Error) => {
      console.log('Connection error:', error)
      this.isConnected.value = false
    })

    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      console.log('Attempting to reconnect:', attemptNumber)
    })

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log('Successfully reconnected after', attemptNumber, 'attempts')
      this.isConnected.value = true
    })

    this.socket.on('reconnect_error', (error: Error) => {
      console.log('Reconnection error:', error)
      this.isConnected.value = false
    })

    this.socket.on('reconnect_failed', () => {
      console.log('Failed to reconnect after all attempts')
      this.isConnected.value = false
    })

    this.socket.on('error', (error: Error) => {
      console.error('Server error:', error)
    })
  }

  getGamesList() {
    return new Promise<GameSummary[]>((resolve, reject) => {
      if (!this.socket?.connected) {
        reject('Нет соединения с сервером')
      } else {
        this.socket.emit(
          'getGamesList',
          (response: { games?: GameSummary[]; error?: string }) => {
            if (response.error) {
              reject(response.error)
            } else {
              this.gamesList = response.games ?? []
              resolve(this.gamesList)
            }
          }
        )
      }
    })
  }

  createGame() {
    return new Promise<GameData>((resolve, reject) => {
      if (!this.socket?.connected) {
        reject('Нет соединения с сервером')
      } else {
        this.socket?.emit('createGame')
        this.socket?.once('error', (error: Error) => reject(error))
        this.socket?.once(
          'gameCreated',
          ({ gameId, game }: { gameId: string; game: GameData }) => {
            this.gameId = gameId
            resolve(game)
          }
        )
      }
    })
  }

  addPlayer({ name, index }: { name: string; index: number }) {
    return new Promise<SocketAck>((resolve, reject) => {
      if (!this.socket?.connected) {
        reject('Нет соединения с сервером')
      } else {
        this.socket.emit(
          'addPlayer',
          { gameId: this.gameId, name, index },
          (response: SocketAck) => {
            if (response.error) {
              reject(response.error)
            } else {
              resolve(response)
            }
          }
        )
      }
    })
  }

  removePlayer(index: number, name: string | null = null) {
    return new Promise<SocketAck>((resolve, reject) => {
      if (!this.socket?.connected) {
        reject('Нет соединения с сервером')
      } else {
        this.socket.emit(
          'removePlayer',
          { gameId: this.gameId, index, name },
          (response: SocketAck) => {
            if (response.error) {
              reject(response.error)
            } else {
              resolve(response)
            }
          }
        )
      }
    })
  }

  startGame() {
    this.socket?.emit('startGame', { gameId: this.gameId })
  }

  joinGame(gameId: string, playerName?: string) {
    return new Promise<GameData>((resolve, reject) => {
      if (!this.socket?.connected) {
        reject('Нет соединения с сервером')
      } else {
        this.socket.emit('joinGame', { gameId, playerName })
        this.socket.once('error', (error: Error) => reject(error))
        this.socket.once('gameUpdated', (game: GameData) => {
          this.gameId = gameId
          resolve(game)
        })
      }
    })
  }

  rejoinGame(gameId: string) {
    return new Promise<GameData>((resolve, reject) => {
      if (!this.socket?.connected) {
        console.error('Socket not connected while rejoining game')
        return
      }
      this.socket.emit('rejoinGame', { gameId, deviceId: this.deviceId })
      this.socket.once('error', (error: Error) => reject(error))
      this.socket.once('gameUpdated', (game: GameData) => {
        this.gameId = gameId
        resolve(game)
      })
    })
  }

  onGameUpdated(callback: (game: GameData) => void) {
    this.socket?.on('gameUpdated', callback)
  }

  onPlayerDisconnected(callback: () => void) {
    this.socket?.on('playerDisconnected', callback)
  }

  async selectPlacingPoint({
    rowIndex,
    tileIndex,
  }: {
    rowIndex: number
    tileIndex: number
  }) {
    return new Promise<SocketAck>((resolve, reject) => {
      this.socket?.emit(
        'selectPlacingPoint',
        { gameId: this.gameId, point: { rowIndex, tileIndex } },
        (response: SocketAck) => {
          if (response.error) {
            reject(response.error)
          } else {
            resolve(response)
          }
        }
      )
    })
  }

  async updateCurrentTile(tile: Tile | GridTile) {
    return new Promise<SocketAck>((resolve, reject) => {
      this.socket?.emit(
        'updateCurrentTile',
        { gameId: this.gameId, tile },
        (response: SocketAck) => {
          if (response.error) {
            reject(response.error)
          } else {
            resolve(response)
          }
        }
      )
    })
  }

  placeTile(
    tile: Tile | GridTile,
    position: { rowIndex: number; tileIndex: number }
  ) {
    return new Promise<SocketAck>((resolve, reject) => {
      this.socket?.emit(
        'placeTile',
        { gameId: this.gameId, tile, position },
        (response: SocketAck) => {
          if (response.error) {
            reject(response.error)
          } else {
            resolve(response)
          }
        }
      )
    })
  }

  placeFollower(place: AvailableFollowerPlace) {
    return new Promise<SocketAck>((resolve, reject) => {
      this.socket?.emit(
        'placeFollower',
        { gameId: this.gameId, place },
        (response: SocketAck) => {
          if (response.error) {
            reject(response.error)
          } else {
            resolve(response)
          }
        }
      )
    })
  }

  skipFollower() {
    return new Promise<SocketAck>((resolve, reject) => {
      this.socket?.emit(
        'skipFollower',
        { gameId: this.gameId },
        (response: SocketAck) => {
          console.log('Server response for skip follower:', response)
          if (response.error) {
            console.error('Server error:', response.error)
            reject(response.error)
          } else {
            resolve(response)
          }
        }
      )
    })
  }

  disconnect() {
    console.log('Manual disconnect called. Current gameId:', this.gameId)
    if (this.socket) {
      const gameId = this.gameId
      this.socket.disconnect()
      this.gameId = gameId
    }
  }

  checkAvailablePlacements(position: { row: number; col: number }) {
    return new Promise<AvailablePlacement[]>((resolve, reject) => {
      this.socket?.emit(
        'checkAvailablePlacements',
        {
          gameId: this.gameId,
          position,
        },
        (response: { placements?: AvailablePlacement[]; error?: string }) => {
          if (response.error) {
            reject(response.error)
          } else {
            resolve(response.placements ?? [])
          }
        }
      )
    })
  }

  leaveGame() {
    this.socket?.emit('leaveGame', { gameId: this.gameId })
  }
}

export default new GameService()
