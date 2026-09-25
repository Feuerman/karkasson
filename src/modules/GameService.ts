import { io, type Socket } from 'socket.io-client'
import { ref } from 'vue'
import type { AvailableFollowerPlace } from '@server/modules/GameManager'
import type { GameSummary, GameData } from '@server/services/GameService'
import type { GridTile, Tile } from '@server/modules/types'
import type {
  SocketAck,
  GamesListResponse,
  AvailablePlacement,
  PlacementsResponse,
  GameCreatedPayload,
} from '@/types/socket'

export interface IGameService {
  socket: Socket | null
  gameId: string
  deviceId: string
  connect: () => void
  disconnect: () => void
  createGame: () => Promise<GameData>
  joinGame: (gameId: string, playerName?: string) => Promise<GameData>
}

export type SocketPayload = Record<string, unknown>

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

  private getNotConnectedError(): string {
    return 'Нет соединения с сервером'
  }

  /** Ack-callback: emit → ответ { error?, ... }. Резолвится самим ответом. */
  private emitAck<T extends object>(
    event: string,
    payload?: SocketPayload
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(this.getNotConnectedError())
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error(`Таймаут ожидания ответа сервера: ${event}`))
      }, 15_000)

      const callback = (response: SocketAck) => {
        clearTimeout(timeout)
        if (response.error) {
          reject(new Error(response.error))
        } else {
          resolve(response as T)
        }
      }

      if (payload === undefined) {
        this.socket.emit(event, callback)
      } else {
        this.socket.emit(event, payload, callback)
      }
    })
  }

  /** Event-based: emit → ждём successEvent, ошибки ловим через 'error'. */
  private emitAndWait<T>(
    sendEvent: string,
    successEvent: string,
    payload: SocketPayload = {}
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(this.getNotConnectedError())
        return
      }

      const socket = this.socket
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error(`Таймаут ожидания события: ${successEvent}`))
      }, 15_000)
      const onError = (error: string | Error) => {
        cleanup()
        reject(error instanceof Error ? error : new Error(error))
      }
      const onSuccess = (data: T) => {
        cleanup()
        resolve(data)
      }
      const cleanup = () => {
        clearTimeout(timeout)
        socket.off('error', onError)
        socket.off(successEvent, onSuccess)
      }

      socket.once('error', onError)
      socket.once(successEvent, onSuccess)
      socket.emit(sendEvent, payload)
    })
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

  async getGamesList() {
    const response = await this.emitAck<GamesListResponse>('getGamesList')
    this.gamesList = response.games ?? []
    return this.gamesList
  }

  async createGame() {
    const response = await this.emitAck<GameCreatedPayload>('createGame')
    const { gameId, game } = response
    this.gameId = gameId
    return game
  }

  addPlayer({ name, index }: { name: string; index: number }) {
    return this.emitAck<SocketAck>('addPlayer', {
      gameId: this.gameId,
      name,
      index,
    })
  }

  removePlayer(index: number, name: string | null = null) {
    return this.emitAck<SocketAck>('removePlayer', {
      gameId: this.gameId,
      index,
      name,
    })
  }

  startGame() {
    return this.emitAck<{ game: GameData }>('startGame', {
      gameId: this.gameId,
    }).then((response) => response.game)
  }

  async joinGame(gameId: string, playerName?: string) {
    const response = await this.emitAck<{ game: GameData }>('joinGame', {
      gameId,
      playerName,
    })
    this.gameId = gameId
    return response.game
  }

  async rejoinGame(gameId: string) {
    const response = await this.emitAck<{ game: GameData }>('rejoinGame', {
      gameId,
      deviceId: this.deviceId,
    })
    this.gameId = gameId
    return response.game
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
    return this.emitAck<SocketAck>('selectPlacingPoint', {
      gameId: this.gameId,
      point: { rowIndex, tileIndex },
    })
  }

  async updateCurrentTile(tile: Tile | GridTile) {
    return this.emitAck<SocketAck>('updateCurrentTile', {
      gameId: this.gameId,
      rotation: tile.rotation,
    })
  }

  setCurrentTileRotation(rotation: number) {
    return this.emitAck<SocketAck>('updateCurrentTile', {
      gameId: this.gameId,
      rotation,
    })
  }

  placeTile(
    tile: Tile | GridTile,
    position: { rowIndex: number; tileIndex: number }
  ) {
    return this.emitAck<SocketAck>('placeTile', {
      gameId: this.gameId,
      rotation: tile.rotation,
      position,
    })
  }

  placeFollower(
    place: AvailableFollowerPlace,
    followerType: 'follower' | 'abbot' = 'follower'
  ) {
    return this.emitAck<SocketAck>('placeFollower', {
      gameId: this.gameId,
      place: {
        point: place.point,
        temporaryObject: { id: place.temporaryObject.id },
      },
      followerType,
    })
  }

  recallAbbot() {
    return this.emitAck<SocketAck>('recallAbbot', { gameId: this.gameId })
  }

  skipFollower() {
    return this.emitAck<SocketAck>('skipFollower', { gameId: this.gameId })
  }

  disconnect() {
    console.log('Manual disconnect called. Current gameId:', this.gameId)
    if (this.socket) {
      const gameId = this.gameId
      this.socket.disconnect()
      this.gameId = gameId
    }
  }

  async checkAvailablePlacements(position: {
    row: number
    col: number
  }): Promise<AvailablePlacement[]> {
    const response = await this.emitAck<PlacementsResponse>(
      'checkAvailablePlacements',
      {
        gameId: this.gameId,
        position,
      }
    )
    return response.placements ?? []
  }

  leaveGame() {
    return this.emitAck<SocketAck>('leaveGame', { gameId: this.gameId })
  }
}

export default new GameService()
