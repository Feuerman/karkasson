import { io, type Socket } from 'socket.io-client'
import { ref, type Ref } from 'vue'
import type { AvailableFollowerPlace } from '@server/modules/GameManager'
import type { GameSummary, GameData } from '@server/services/GameService'
import {
  FollowerType,
  SocketEvents,
  PROTOCOL_VERSION,
  type GridTile,
  type Tile,
  type FollowerType as FollowerTypeValue,
  type PlacementConflict,
  type Point,
} from '@server/modules/types'
import type {
  SocketAck,
  GameAck,
  GamesListResponse,
  GetGamesListRequest,
  CreateGameResponse,
  PrincessChoicePayload,
  DragonMovePayload,
  FairyMovePayload,
  RemovePlayerPayload,
  GameDeletedPayload,
} from '@/types/socket'
import { createLogger } from '@/utils/logger'
import {
  classifyConnectError,
  type ConnectionErrorCode,
  type ConnectionPhase,
} from './connectionStatus'

const logger = createLogger('GameService')

export interface IGameService {
  socket: Socket | null
  gameId: string
  sessionId: Ref<string | null>
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
  /** Стабильный машинный код отказа, если сервер его прислал. */
  readonly code?: string

  constructor(
    message: string,
    conflicts: PlacementConflict[] = [],
    code?: string
  ) {
    super(message)
    this.name = 'SocketAckError'
    this.conflicts = conflicts
    this.code = code
  }
}

export interface GameServiceOptions {
  serverUrl?: string
  sessionToken?: string
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
const SESSION_TOKEN_STORAGE_KEY = 'sessionToken'
const SOCKET_ACK_TIMEOUT_MS = 15_000
/** Версия протокола этого клиента: сверяется с ответом сервера. */
const CLIENT_PROTOCOL_VERSION = PROTOCOL_VERSION
const PROTOCOL_MISMATCH_ERROR =
  'Требуется перезагрузка страницы: версия протокола клиента и сервера не совпадают'
const CONNECTION_INTERRUPTED_ERROR =
  'Соединение с сервером прервано, попробуйте отправить команду ещё раз'

let commandSequence = 0

/**
 * Ключ идемпотентности игровой команды. Повторная доставка того же запроса
 * после таймаута ack не должна применить ход дважды.
 */
function createCommandId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  commandSequence = (commandSequence + 1) % 1_000_000
  return `cmd-${Date.now().toString(36)}-${commandSequence.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

function readStoredSessionToken(): string {
  try {
    return localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function storeSessionToken(token: string): void {
  try {
    localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token)
  } catch {
    // Приватный режим или переполненное хранилище: сессия проживёт до
    // перезагрузки страницы, но приложение не должно падать.
  }
}

/** Состояние сети браузера; вне браузера считаем сеть доступной. */
function readOnlineState(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false
}

export class GameService implements IGameService {
  socket: Socket | null
  gameId: string
  /** Публичный идентификатор сессии: по нему клиент узнаёт свои фишки. */
  sessionId = ref<string | null>(null)
  gamesList: GameSummary[] = []
  /** Всего партий после применения фильтра. */
  gamesListTotal = 0
  /** Текущая страница (начиная с 1). */
  gamesListPage = 1
  /** Размер страницы. */
  gamesListPageSize = 0
  /** Есть ли следующая страница. */
  gamesListHasMore = false
  isConnected = ref(false)
  /** Идентификатор текущего сокета: меняется при каждом переподключении. */
  socketId = ref<string | null>(null)
  /** Текущая фаза соединения для индикатора и экрана восстановления. */
  connectionPhase = ref<ConnectionPhase>('connecting')
  /** Есть ли у браузера доступ к сети. */
  isOnline = ref(readOnlineState())
  /** Номер текущей попытки переподключения. */
  reconnectAttempt = ref(0)
  /** Причина последнего обрыва из Socket.IO: помогает отличить сервер. */
  lastDisconnectReason = ref<string | null>(null)
  /** Категория последней ошибки рукопожатия. */
  connectionErrorCode = ref<ConnectionErrorCode | null>(null)
  /** Сервер подтвердил сессию для текущего сокета. */
  sessionReady = ref(false)
  /** Версия серверного протокола, полученная при регистрации сессии. */
  serverProtocolVersion = ref<string | null>(null)
  /** Протокол клиента и сервера не совпадают: нужна перезагрузка страницы. */
  protocolMismatch = ref(false)
  /** Версия клиентской сборки для диагностики (из VITE_APP_VERSION). */
  get clientVersion(): string {
    return (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev'
  }
  private serverUrl: string
  private sessionToken: string
  /** Сервер подтвердил сессию для текущего сокета (внутренний флаг). */
  private sessionRegistered = false
  /**
   * Сессию забрала другая вкладка. Старый сокет отключён сервером и не должен
   * автоматически переподключаться, иначе вкладки будут бесконечно отбирать
   * управление друг у друга.
   */
  private sessionReplaced = false
  /** Готовность регистрации: команды не должны опережать выдачу сессии. */
  private sessionReadyPromise: Promise<void> = Promise.resolve()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
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
    this.sessionToken = options.sessionToken ?? readStoredSessionToken()

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', this.handleBrowserOnline)
      window.addEventListener('offline', this.handleBrowserOffline)
    }
  }

  private handleBrowserOnline = (): void => {
    this.isOnline.value = true
    if (this.isConnected.value) return
    this.connectionPhase.value = 'reconnecting'
    this.reconnectNow()
  }

  private handleBrowserOffline = (): void => {
    this.isOnline.value = false
    if (!this.isConnected.value) {
      this.connectionPhase.value = 'offline'
    }
  }

  private getNotConnectedError(): string {
    return 'Нет соединения с сервером'
  }

  /**
   * Ждёт, пока сервер выдаст или подтвердит сессию. Без этого первая команда
   * после холодного старта могла бы уйти раньше регистрации и создать слот
   * без владельца.
   */
  private async whenSessionReady(): Promise<void> {
    if (this.sessionRegistered) return
    if (!this.socket?.connected) throw new Error(this.getNotConnectedError())
    await this.sessionReadyPromise
    if (!this.sessionRegistered) {
      throw new Error(
        'Не удалось установить сессию. Переподключитесь к серверу'
      )
    }
  }

  /** Ack-callback: emit → ответ { error?, ... }. Резолвится самим ответом. */
  private emitAck<T extends object>(
    event: string,
    payload?: SocketPayload
  ): Promise<T> {
    if (this.protocolMismatch.value) {
      return Promise.reject(new Error(PROTOCOL_MISMATCH_ERROR))
    }
    const wasConnected = Boolean(this.socket?.connected)
    return this.whenSessionReady().then(
      () =>
        new Promise<T>((resolve, reject) => {
          if (!this.socket?.connected) {
            reject(
              wasConnected
                ? new Error(CONNECTION_INTERRUPTED_ERROR)
                : this.getNotConnectedError()
            )
            return
          }

          // Ответ может прийти и после разрыва. Без явной отмены промис
          // висел бы до таймаута, и игрок увидел бы ошибку уже после
          // применённого хода.
          const cancel = (error: Error) => {
            clearTimeout(timeout)
            this.pendingAcks.delete(cancel)
            reject(error)
          }
          this.pendingAcks.add(cancel)

          const timeout = setTimeout(() => {
            cancel(new Error('Сервер не ответил вовремя. Повторите действие'))
          }, SOCKET_ACK_TIMEOUT_MS)

          const callback = (response: SocketAck) => {
            clearTimeout(timeout)
            this.pendingAcks.delete(cancel)
            if (response.error) {
              reject(
                new SocketAckError(
                  response.error,
                  response.conflicts ?? [],
                  response.code
                )
              )
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
    )
  }

  private rejectPendingAcks(error: Error): void {
    const pending = [...this.pendingAcks]
    this.pendingAcks.clear()
    pending.forEach((cancel) => cancel(error))
  }

  /**
   * Изменяющая игровая команда: к запросу добавляется ключ идемпотентности.
   * Транзиентный предпросмотр его не получает — он не сохраняется.
   */
  private emitGameCommand<T extends object>(
    event: string,
    payload: SocketPayload
  ): Promise<T> {
    return this.emitAck<T>(event, {
      ...payload,
      commandId: createCommandId(),
    })
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

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  /** Повторяет попытку так же, как это делает Socket.IO для обрывов. */
  private scheduleReconnect(): void {
    this.clearReconnectTimer()
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.socket || this.socket.connected) return
      this.socket.connect()
    }, 1000)
  }

  /**
   * Обменивает сохранённый токен на подтверждённую сессию. Сервер сам решает,
   * принимать старый токен или выдать новый; клиент только сохраняет ответ.
   */
  private registerSession(socket: Socket): void {
    this.sessionRegistered = false
    this.sessionReady.value = false
    this.sessionReadyPromise = new Promise<void>((resolve) => {
      const finish = (response?: {
        token?: unknown
        sessionId?: unknown
        protocolVersion?: unknown
      }) => {
        clearTimeout(timer)
        const token =
          typeof response?.token === 'string' ? response.token : undefined
        const sessionId =
          typeof response?.sessionId === 'string'
            ? response.sessionId
            : undefined
        const serverProtocolVersion =
          typeof response?.protocolVersion === 'string'
            ? response.protocolVersion
            : null
        if (token && sessionId) {
          this.sessionToken = token
          this.sessionId.value = sessionId
          this.sessionRegistered = true
          storeSessionToken(token)
        }
        this.sessionReady.value = this.sessionRegistered
        this.serverProtocolVersion.value = serverProtocolVersion
        // Сервер ещё не отдаёт версию (старый деплой) — не можем обнаружить
        // несовпадение, поэтому не блокируем. При наличии версии сервера и
        // несовпадении с клиентом требуется перезагрузка страницы.
        this.protocolMismatch.value =
          serverProtocolVersion !== null &&
          serverProtocolVersion !== CLIENT_PROTOCOL_VERSION
        resolve()
      }

      // Сервер может не ответить при обрыве сразу после рукопожатия. Ждём
      // ограниченно: следующая команда и так получит понятный отказ, а
      // подвисший промис заблокировал бы все действия до переподключения.
      const timer = setTimeout(() => finish(), 10_000)
      socket.emit(
        SocketEvents.RegisterSession,
        {
          ...(this.sessionToken ? { token: this.sessionToken } : {}),
          protocolVersion: CLIENT_PROTOCOL_VERSION,
        },
        finish
      )
    })
  }

  /**
   * Ручная попытка восстановить соединение. Нужна, когда игрок увидел
   * «сервер недоступен» и не хочет ждать следующей автоматической попытки.
   */
  reconnectNow(): void {
    this.isOnline.value = readOnlineState()
    // Ручной retry — осознанный возврат управления: вкладка снова забирает
    // сессию, поэтому прежний запрет на автоматическое переподключение снят.
    this.sessionReplaced = false
    this.connectionErrorCode.value = null
    this.reconnectAttempt.value = 0
    this.connectionPhase.value = this.isOnline.value
      ? 'reconnecting'
      : 'offline'
    if (this.isConnected.value) return
    if (this.socket) {
      this.socket.connect()
    } else {
      this.connect()
    }
  }

  connect() {
    logger.debug('Attempting to connect to server...')
    this.sessionReplaced = false
    if (this.socket?.connected) {
      logger.debug('Socket already connected, skipping connection')
      return
    }

    // Сокет уже создан и переживает разрывы сам: у него сохранены и слушатели,
    // и подписки вызывающего кода. Новый сокет означал бы потерю подписок.
    if (this.socket) {
      logger.debug('Reusing existing socket for reconnection')
      this.connectionErrorCode.value = null
      this.connectionPhase.value = this.isOnline.value
        ? 'reconnecting'
        : 'offline'
      this.socket.connect()
      return
    }

    this.connectionPhase.value = 'connecting'
    this.connectionErrorCode.value = null
    this.lastDisconnectReason.value = null
    this.reconnectAttempt.value = 0

    const SERVER_URL = this.serverUrl
    const isSecure = SERVER_URL.startsWith('https')
    const socket = io(SERVER_URL, {
      secure: isSecure,
      rejectUnauthorized: isSecure,
      // Polling с последующим upgrade: websocket-only ломался при жёстком
      // CORS и не давал запасного пути в сетях, где WS недоступен.
      transports: ['polling', 'websocket'],
      // Если polling недоступен (CORS, прокси, CSP), пробуем WebSocket,
      // а не сдаёмся после ошибки первого транспорта.
      tryAllTransports: true,
      reconnection: true,
      // Render засыпает и отвечает 503/522, пока инстанс поднимается. Ограничение
      // попыток теряло сессию до окончания холодного старта, поэтому повторяем
      // бесконечно с ограниченной паузой.
      reconnectionAttempts: Number.POSITIVE_INFINITY,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      forceNew: false,
    })
    this.socket = socket

    socket.on('connect', () => {
      logger.info('Connected to server')
      this.clearReconnectTimer()
      this.isConnected.value = true
      this.connectionPhase.value = 'connected'
      this.connectionErrorCode.value = null
      this.lastDisconnectReason.value = null
      this.reconnectAttempt.value = 0
      this.socketId.value = socket.id ?? null
      this.registerSession(socket)
    })

    socket.on('disconnect', (reason: string) => {
      logger.info('Disconnected from server:', reason)
      this.isConnected.value = false
      this.sessionRegistered = false
      this.sessionReady.value = false
      this.socketId.value = null
      this.lastDisconnectReason.value = reason
      this.connectionPhase.value = this.sessionReplaced
        ? 'replaced'
        : this.isOnline.value
          ? 'reconnecting'
          : 'offline'
      this.rejectPendingAcks(
        new Error('Соединение с сервером прервано, команда не доставлена')
      )
      // Socket.IO сам повторяет только транспортные обрывы. Явное
      // отключение сервером (например, при выкатке) требует ручного
      // перезапуска с той же паузой, что и обычные попытки.
      if (reason === 'io server disconnect') {
        // Сессию забрала другая вкладка: сервер уже передал ей управление.
        // Автоматически переподключаться нельзя, иначе вкладки будут
        // бесконечно забирать сессию друг у друга.
        if (this.sessionReplaced) return
        this.scheduleReconnect()
      }
    })

    socket.on(SocketEvents.SessionReplaced, () => {
      logger.warn('Session was taken over by another tab')
      this.sessionReplaced = true
      this.sessionRegistered = false
      this.connectionPhase.value = 'replaced'
      this.isConnected.value = false
      this.socketId.value = null
    })

    socket.on('connect_error', (error: Error) => {
      logger.warn('Connection error:', error)
      this.isConnected.value = false
      this.socketId.value = null
      this.reconnectAttempt.value += 1
      this.connectionErrorCode.value = classifyConnectError(error.message)
      this.connectionPhase.value = this.isOnline.value
        ? 'reconnecting'
        : 'offline'
    })

    socket.on('reconnect_attempt', (attemptNumber: number) => {
      logger.debug('Attempting to reconnect:', attemptNumber)
      this.reconnectAttempt.value = attemptNumber
      this.connectionPhase.value = this.isOnline.value
        ? 'reconnecting'
        : 'offline'
    })

    socket.on('reconnect', (attemptNumber: number) => {
      logger.info('Successfully reconnected after', attemptNumber, 'attempts')
      this.isConnected.value = true
      this.socketId.value = socket.id ?? null
    })

    socket.on('reconnect_error', (error: Error) => {
      logger.warn('Reconnection error:', error)
      this.isConnected.value = false
      this.socketId.value = null
      this.connectionErrorCode.value = classifyConnectError(error.message)
      this.connectionPhase.value = this.isOnline.value
        ? 'reconnecting'
        : 'offline'
    })

    socket.on('reconnect_failed', () => {
      logger.error('Failed to reconnect after all attempts')
      this.isConnected.value = false
      this.socketId.value = null
      this.connectionPhase.value = this.isOnline.value
        ? 'reconnecting'
        : 'offline'
      this.connectionErrorCode.value = 'unknown'
      // На случай неожиданного исчерпания попыток не оставляем игрока без
      // возможности восстановиться: продолжаем попытки с паузой.
      this.scheduleReconnect()
    })

    socket.on(SocketEvents.Error, (error: Error) => {
      logger.error('Server error:', error)
    })

    this.attachSubscriptions(socket)
  }

  async getGamesList(options: GetGamesListRequest = {}) {
    const response = await this.emitAck<GamesListResponse>(
      SocketEvents.GetGamesList,
      options as SocketPayload
    )
    this.gamesList = response.games ?? []
    this.gamesListTotal = response.total ?? 0
    this.gamesListPage = response.page ?? 1
    this.gamesListPageSize = response.pageSize ?? 0
    this.gamesListHasMore = response.hasMore ?? false
    return {
      games: this.gamesList,
      total: this.gamesListTotal,
      page: this.gamesListPage,
      pageSize: this.gamesListPageSize,
      hasMore: this.gamesListHasMore,
    }
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
      { gameId }
    )
    this.gameId = gameId
    return response.game
  }

  onGameUpdated(callback: (game: GameData) => void) {
    return this.onSocketEvent(SocketEvents.GameUpdated, callback)
  }

  onGameDeleted(callback: (payload: GameDeletedPayload) => void) {
    return this.onSocketEvent(SocketEvents.GameDeleted, callback)
  }

  async selectPlacingPoint({
    rowIndex,
    tileIndex,
  }: {
    rowIndex: number
    tileIndex: number
  }) {
    return this.emitAck<GameAck>(SocketEvents.SelectPlacingPoint, {
      gameId: this.gameId,
      point: { rowIndex, tileIndex },
    })
  }

  setCurrentTileRotation(rotation: number) {
    return this.emitAck<GameAck>(SocketEvents.UpdateCurrentTile, {
      gameId: this.gameId,
      rotation,
    })
  }

  placeTile(
    tile: Tile | GridTile,
    position: { rowIndex: number; tileIndex: number }
  ) {
    return this.emitGameCommand<GameAck>(SocketEvents.PlaceTile, {
      gameId: this.gameId,
      rotation: tile.rotation,
      position,
    })
  }

  placeFollower(
    place: AvailableFollowerPlace,
    followerType: FollowerTypeValue = FollowerType.Follower
  ) {
    return this.emitGameCommand<GameAck>(SocketEvents.PlaceFollower, {
      gameId: this.gameId,
      place: {
        point: place.point,
        temporaryObject: { id: place.temporaryObject.id },
      },
      followerType,
    })
  }

  recallAbbot() {
    return this.emitGameCommand<GameAck>(SocketEvents.RecallAbbot, {
      gameId: this.gameId,
    })
  }

  moveDragon(position: { rowIndex: number; tileIndex: number }) {
    const payload: DragonMovePayload & SocketPayload = {
      gameId: this.gameId,
      position,
    }
    return this.emitGameCommand<GameAck>(SocketEvents.MoveDragon, payload)
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
    return this.emitGameCommand<GameAck>(SocketEvents.ChoosePrincess, payload)
  }

  moveFairy(point: Point) {
    const payload: FairyMovePayload & SocketPayload = {
      gameId: this.gameId,
      point,
    }
    return this.emitGameCommand<GameAck>(SocketEvents.MoveFairy, payload)
  }

  skipFollower() {
    return this.emitGameCommand<GameAck>(SocketEvents.SkipFollower, {
      gameId: this.gameId,
    })
  }

  disconnect() {
    logger.debug('Manual disconnect called. Current gameId:', this.gameId)
    this.clearReconnectTimer()
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
