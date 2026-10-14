import { io, type Socket } from 'socket.io-client'
import { ref } from 'vue'
import type { AvailableFollowerPlace } from '@server/modules/GameManager'
import type { GameSummary, GameData } from '@server/services/GameService'
import {
  FollowerType,
  SocketEvents,
  type GridTile,
  type Tile,
  type FollowerType as FollowerTypeValue,
  type PlacementConflict,
} from '@server/modules/types'
import type {
  SocketAck,
  GamesListResponse,
  CreateGameResponse,
  PrincessChoicePayload,
  DragonMovePayload,
  RemovePlayerPayload,
} from '@/types/socket'

export interface IGameService {
  socket: Socket | null
  gameId: string
  deviceId: string
  connect: () => void
  disconnect: () => void
  createGame: (options?: CreateGameOptions) => Promise<GameData>
  joinGame: (gameId: string, playerName?: string) => Promise<GameData>
}

export type SocketPayload = Record<string, unknown>

/** Подписка на событие сокета, которая переживает переподключение. */
interface SocketSubscription {
  event: string
  callback: SocketListener
}

/** Тип обработчика события в socket.io-client. */
type SocketListener = Parameters<Socket['on']>[1]

/** События приложения плюс зарезервированные события подключения. */
type ClientSocketEvent =
  (typeof SocketEvents)[keyof typeof SocketEvents] | 'connect' | 'disconnect'

/** Ошибка ack-ответа сервера; conflicts описывает причину отказа размещения. */
export class SocketAckError extends Error {
  readonly conflicts: PlacementConflict[]

  constructor(message: string, conflicts: PlacementConflict[] = []) {
    super(message)
    this.name = 'SocketAckError'
    this.conflicts = conflicts
  }
}

export interface GameServiceOptions {
  serverUrl?: string
  deviceId?: string
}

export interface CreateGameOptions {
  finalScoringEnabled?: boolean
  innsAndCathedralsEnabled?: boolean
  riverEnabled?: boolean
  princessAndDragonEnabled?: boolean
}

// Адрес сервера переопределяется через VITE_SERVER_URL (локальная разработка/тесты)
const DEFAULT_SERVER_URL =
  import.meta.env.VITE_SERVER_URL || 'https://karkasson.onrender.com'
const DEVICE_ID_STORAGE_KEY = 'deviceId'
const SOCKET_ACK_TIMEOUT_MS = 15_000

export class GameService implements IGameService {
  socket: Socket | null
  gameId: string
  deviceId: string
  gamesList: GameSummary[] = []
  isConnected = ref(false)
  private serverUrl: string
  private readonly pendingAcks = new Set<(error: Error) => void>()
  /**
   * Подписки вызывающего кода: сокет переподключается, а они должны остаться
   * на месте, поэтому хранятся здесь и навешиваются на каждый новый сокет.
   */
  private readonly subscriptions = new Set<SocketSubscription>()

  constructor(options: GameServiceOptions = {}) {
    this.socket = null
    this.gameId = ''
    this.gamesList = []
    this.serverUrl = options.serverUrl ?? DEFAULT_SERVER_URL
    this.deviceId =
      options.deviceId ??
      localStorage.getItem(DEVICE_ID_STORAGE_KEY) ??
      crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, this.deviceId)
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

      // Ответ может прийти и после разрыва. Без явной отмены промис висел бы
      // до таймаута, и игрок увидел бы ошибку уже после применённого хода.
      const cancel = (error: Error) => {
        clearTimeout(timeout)
        this.pendingAcks.delete(cancel)
        reject(error)
      }
      this.pendingAcks.add(cancel)

      const timeout = setTimeout(() => {
        cancel(new Error(`Таймаут ожидания ответа сервера: ${event}`))
      }, SOCKET_ACK_TIMEOUT_MS)

      const callback = (response: SocketAck) => {
        clearTimeout(timeout)
        this.pendingAcks.delete(cancel)
        if (response.error) {
          reject(new SocketAckError(response.error, response.conflicts ?? []))
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

  private rejectPendingAcks(error: Error): void {
    const pending = [...this.pendingAcks]
    this.pendingAcks.clear()
    pending.forEach((cancel) => cancel(error))
  }

  /**
   * Подписка на событие сокета. Обработчик переживает и переподключение, и
   * повторный вызов `connect`, потому что хранится в сервисе, а не на сокете.
   * Возвращает функцию отписки.
   */
  onSocketEvent<E extends ClientSocketEvent>(
    event: E,
    callback: (payload: never) => void
  ): () => void {
    const subscription: SocketSubscription = {
      event,
      callback: callback as SocketListener,
    }
    this.subscriptions.add(subscription)
    this.socket?.on(event as string, subscription.callback)

    return () => {
      if (!this.subscriptions.delete(subscription)) return
      this.socket?.off(event as string, subscription.callback)
    }
  }

  /** Переносит подписки вызывающего кода на только что созданный сокет. */
  private attachSubscriptions(socket: Socket): void {
    this.subscriptions.forEach(({ event, callback }) => {
      socket.on(event, callback)
    })
  }

  connect() {
    console.log('Attempting to connect to server...')
    if (this.socket?.connected) {
      console.log('Socket already connected, skipping connection')
      return
    }

    // Сокет уже создан и переживает разрывы сам: у него сохранены и слушатели,
    // и подписки вызывающего кода. Новый сокет означал бы потерю подписок.
    if (this.socket) {
      console.log('Reusing existing socket for reconnection')
      this.socket.connect()
      return
    }

    const SERVER_URL = this.serverUrl
    const isSecure = SERVER_URL.startsWith('https')
    const socket = io(SERVER_URL, {
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
    this.socket = socket

    socket.on('connect', () => {
      console.log('Connected to server')
      this.isConnected.value = true
      this.socket?.emit(SocketEvents.RegisterDevice, {
        deviceId: this.deviceId,
      })
    })

    socket.on('disconnect', (reason: string) => {
      console.log('Disconnected from server:', reason)
      this.isConnected.value = false
      this.rejectPendingAcks(
        new Error('Соединение с сервером прервано, команда не доставлена')
      )
      if (
        reason === 'io server disconnect' ||
        reason === 'io client disconnect'
      ) {
        console.log('Attempting to reconnect after disconnect...')
        socket.connect()
      }
    })

    socket.on('connect_error', (error: Error) => {
      console.log('Connection error:', error)
      this.isConnected.value = false
    })

    socket.on('reconnect_attempt', (attemptNumber: number) => {
      console.log('Attempting to reconnect:', attemptNumber)
    })

    socket.on('reconnect', (attemptNumber: number) => {
      console.log('Successfully reconnected after', attemptNumber, 'attempts')
      this.isConnected.value = true
    })

    socket.on('reconnect_error', (error: Error) => {
      console.log('Reconnection error:', error)
      this.isConnected.value = false
    })

    socket.on('reconnect_failed', () => {
      console.log('Failed to reconnect after all attempts')
      this.isConnected.value = false
    })

    socket.on(SocketEvents.Error, (error: Error) => {
      console.error('Server error:', error)
    })

    this.attachSubscriptions(socket)
  }

  async getGamesList() {
    const response = await this.emitAck<GamesListResponse>(
      SocketEvents.GetGamesList
    )
    this.gamesList = response.games ?? []
    return this.gamesList
  }

  async createGame(options: CreateGameOptions = {}) {
    const response = await this.emitAck<CreateGameResponse>(
      SocketEvents.CreateGame,
      {
        finalScoringEnabled: options.finalScoringEnabled,
        innsAndCathedralsEnabled: options.innsAndCathedralsEnabled,
        riverEnabled: options.riverEnabled,
        princessAndDragonEnabled: options.princessAndDragonEnabled,
      }
    )
    const { gameId, game } = response
    this.gameId = gameId
    return game
  }

  addPlayer({ name, index }: { name: string | null; index: number }) {
    return this.emitAck<SocketAck>(SocketEvents.AddPlayer, {
      gameId: this.gameId,
      name,
      index,
    })
  }

  removePlayer(index: number, keepAsComputer: boolean) {
    const payload: SocketPayload & RemovePlayerPayload = {
      gameId: this.gameId,
      index,
      keepAsComputer,
    }
    return this.emitAck<SocketAck>(SocketEvents.RemovePlayer, payload)
  }

  startGame() {
    return this.emitAck<{ game: GameData }>(SocketEvents.StartGame, {
      gameId: this.gameId,
    }).then((response) => response.game)
  }

  async joinGame(gameId: string, playerName?: string) {
    const response = await this.emitAck<{ game: GameData }>(
      SocketEvents.JoinGame,
      { gameId, playerName }
    )
    this.gameId = response.game.id ?? gameId
    return response.game
  }

  async rejoinGame(gameId: string) {
    const response = await this.emitAck<{ game: GameData }>(
      SocketEvents.RejoinGame,
      { gameId, deviceId: this.deviceId }
    )
    this.gameId = gameId
    return response.game
  }

  onGameUpdated(callback: (game: GameData) => void) {
    return this.onSocketEvent(SocketEvents.GameUpdated, callback)
  }

  async selectPlacingPoint({
    rowIndex,
    tileIndex,
  }: {
    rowIndex: number
    tileIndex: number
  }) {
    return this.emitAck<SocketAck>(SocketEvents.SelectPlacingPoint, {
      gameId: this.gameId,
      point: { rowIndex, tileIndex },
    })
  }

  setCurrentTileRotation(rotation: number) {
    return this.emitAck<SocketAck>(SocketEvents.UpdateCurrentTile, {
      gameId: this.gameId,
      rotation,
    })
  }

  placeTile(
    tile: Tile | GridTile,
    position: { rowIndex: number; tileIndex: number }
  ) {
    return this.emitAck<SocketAck>(SocketEvents.PlaceTile, {
      gameId: this.gameId,
      rotation: tile.rotation,
      position,
    })
  }

  placeFollower(
    place: AvailableFollowerPlace,
    followerType: FollowerTypeValue = FollowerType.Follower
  ) {
    return this.emitAck<SocketAck>(SocketEvents.PlaceFollower, {
      gameId: this.gameId,
      place: {
        point: place.point,
        temporaryObject: { id: place.temporaryObject.id },
      },
      followerType,
    })
  }

  recallAbbot() {
    return this.emitAck<SocketAck>(SocketEvents.RecallAbbot, {
      gameId: this.gameId,
    })
  }

  moveDragon(position: { rowIndex: number; tileIndex: number }) {
    const payload: DragonMovePayload & SocketPayload = {
      gameId: this.gameId,
      position,
    }
    return this.emitAck<SocketAck>(SocketEvents.MoveDragon, payload)
  }

  choosePrincessFollower(
    cityId: string,
    point: PrincessChoicePayload['point']
  ) {
    const payload: PrincessChoicePayload & SocketPayload = {
      gameId: this.gameId,
      cityId,
      point,
    }
    return this.emitAck<SocketAck>(SocketEvents.ChoosePrincess, payload)
  }

  skipFollower() {
    return this.emitAck<SocketAck>(SocketEvents.SkipFollower, {
      gameId: this.gameId,
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

  leaveGame() {
    return this.emitAck<SocketAck>(SocketEvents.LeaveGame, {
      gameId: this.gameId,
    })
  }
}

export default new GameService()
