import { GameManager } from '../modules/GameManager'
import { readGameSummary, serializeGameState } from '../modules/gameSave'
import type {
  GameSavePayload,
  GameSummaryRecord,
  IGameDatabase,
} from '../modules/Database'
import {
  CommonErrors,
  GameSaveError,
  LobbyErrors,
  SaveErrors,
} from '../modules/errors'
import { randomInt } from 'node:crypto'
import {
  getSessionSecret,
  MAX_ACTIVE_AI_GAMES,
  MAX_ACTIVE_AI_GAMES_PER_SESSION,
  MAX_OWNED_LOBBIES,
  MAX_PENDING_SAVES_PER_GAME,
  MAX_TOTAL_GAMES,
} from '../config'
import { playerNameKey } from '../modules/playerName'
import { getErrorMessage } from '../utils/common'
import { createLogger } from '../utils/logger'
import { ComputerMoveScheduler, isComputerPlayer } from './computerPlayer'
import { createSessionToken, verifySessionToken } from './sessionToken'
import {
  sortGameSummaries,
  toGameSummary,
  type GameSummary,
} from './gameSummary'
import {
  playerColorForIndex,
  playerNameForIndex,
  expansionOptionsFromRules,
  type GameDeletionReason,
  type GameOptions,
  type Player,
} from '../modules/types'

export type { GameData } from './gameView'
export type { GameSummary, GameSummaryPlayer } from './gameSummary'

const logger = createLogger('GameService')

export interface JoinResult {
  error: string
}

export interface GameServiceLimits {
  maxTotalGames: number
  maxOwnedLobbies: number
  maxActiveAiGames: number
  maxActiveAiGamesPerSession: number
  maxPendingSavesPerGame: number
}

export interface GameCleanupOptions {
  /** Возраст партии без подключённых игроков, после которого её удаляют. */
  abandonedTimeoutMs: number
  /** Срок хранения завершённых партий. */
  finishedRetentionMs: number
}

export interface DeletedGameInfo {
  gameId: string
  reason: GameDeletionReason
}

/**
 * ����������� ��������� ���������: ������� ������ � ������, ��� ��� ��
 * �������� � ������� ���������� �� ������� ���������. ��������� ��������
 * ������� ��� �� ������� �� ����� �������� � ����������.
 */
export interface StorageStatus {
  games: number
  pendingSaves: number
  pendingSaveOperations: number
  oldestSaveAgeMs: number
  saveFailures: number
  pendingCommands: number
  unreadableSaves: number
}

/** ������� ��� ����� ����� ��������� �������� ������� ����������. */
const FLUSH_MAX_ROUNDS = 8

/** Сколько помнить успешные команды, чтобы отсечь повтор после таймаута ack. */
const COMMAND_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000

/** Верхняя граница памяти на идемпотентность одной партии. */
const MAX_COMPLETED_COMMANDS_PER_GAME = 200

function ignoreResult(): void {}

/**
 * Хранит игры в памяти и содержит всю логику лобби/жизненного цикла игры.
 * Не знает про socket.io — рассылку событий делают обработчики сокетов.
 */
export class GameService {
  /**
   * Планировщик ходов компьютера. Таймеры и цепочки ходов живут в экземпляре
   * планировщика, а не в модуле: так сервер можно поднять в нескольких
   * экземплярах, а состояние планировщика — изолировать в тестах.
   */
  readonly computerMoves = new ComputerMoveScheduler()
  private games: Record<string, GameManager> = {}
  /** Обратная карта: сокет → сессия. Заполняется при регистрации. */
  private socketToSessionMap: Record<string, string> = {}
  private lobbyOwners: Record<string, string> = {}
  /**
   * Заголовки всех сохранённых партий. Живые партии берутся из реестра, а этот
   * кэш нужен для списка лобби и ленивой загрузки: читать и разбирать все
   * сохранения при старте больше не требуется.
   */
  private readonly savedSummaries = new Map<string, GameSummaryRecord>()
  private readonly pendingHydrations = new Map<
    string,
    Promise<GameManager | undefined>
  >()
  private readonly pendingSaves = new Map<string, Promise<void>>()
  private readonly pendingDeletions = new Map<string, Promise<void>>()
  private readonly saveQueueDepth = new Map<string, number>()
  private readonly saveQueueSince = new Map<string, number>()
  private readonly completedCommands = new Map<string, Map<string, number>>()
  private readonly gameCommands = new Map<string, { tail: Promise<void> }>()
  /** Сколько сохранений не удалось прочитать при последней загрузке. */
  private unreadableSaves = 0
  /** Сколько записей в хранилище завершились ошибкой. */
  private saveFailureCount = 0
  private readonly limits: GameServiceLimits

  constructor(
    private readonly db: IGameDatabase,
    private readonly sessionSecret: string = getSessionSecret(),
    limits: Partial<GameServiceLimits> = {}
  ) {
    this.limits = {
      maxTotalGames: limits.maxTotalGames ?? MAX_TOTAL_GAMES,
      maxOwnedLobbies: limits.maxOwnedLobbies ?? MAX_OWNED_LOBBIES,
      maxActiveAiGames: limits.maxActiveAiGames ?? MAX_ACTIVE_AI_GAMES,
      maxActiveAiGamesPerSession:
        limits.maxActiveAiGamesPerSession ?? MAX_ACTIVE_AI_GAMES_PER_SESSION,
      maxPendingSavesPerGame:
        limits.maxPendingSavesPerGame ?? MAX_PENDING_SAVES_PER_GAME,
    }
  }

  restoreGame(gameId: string, game: GameManager): void {
    this.games[gameId] = game
  }

  /**
   * Выполняет команду под мьютексом партии: команды одной игры идут строго
   * по очереди, разные игры не блокируют друг друга.
   *
   * Команда меняет состояние и ждёт сохранения, поэтому между мутацией и
   * `await` управление уходит циклу событий. Без очереди вторая команда
   * успевала бы войти в свой хендлер, снять снимок поверх ещё не
   * сохранённого состояния и затереть изменение первой через `copyStateFrom`.
   */
  runGameCommand<T>(gameId: string, command: () => Promise<T>): Promise<T> {
    const previous = this.gameCommands.get(gameId)?.tail ?? Promise.resolve()
    const result = previous.then(command, command)

    // Ошибка команды не должна оставлять партию заблокированной, поэтому
    // очередь ждёт завершения независимо от исхода.
    const entry = { tail: result.then(ignoreResult, ignoreResult) }
    this.gameCommands.set(gameId, entry)
    void entry.tail.then(() => {
      if (this.gameCommands.get(gameId) === entry) {
        this.gameCommands.delete(gameId)
      }
    })

    return result
  }

  /** Число партий, у которых команда стоит в очереди или выполняется. */
  pendingGameCommandCount(): number {
    return this.gameCommands.size
  }

  /**
   * Дожидается завершения уже принятых команд. Нужен при остановке сервера:
   * команда, начатая до закрытия сокетов, должна успеть сохранить состояние.
   */
  async drainCommands(): Promise<void> {
    for (let round = 0; round < FLUSH_MAX_ROUNDS; round += 1) {
      if (this.gameCommands.size === 0) return
      await Promise.all(
        [...this.gameCommands.values()].map((entry) => entry.tail)
      )
    }
    throw new Error('Game commands did not settle while shutting down')
  }

  /** Уже применена ли команда с этим ключом в партии. */
  isCommandCompleted(gameId: string, commandKey: string): boolean {
    const commands = this.completedCommands.get(gameId)
    if (!commands) return false

    const completedAt = commands.get(commandKey)
    if (completedAt === undefined) return false
    if (Date.now() - completedAt > COMMAND_IDEMPOTENCY_TTL_MS) {
      commands.delete(commandKey)
      return false
    }
    return true
  }

  /** Запоминает успешно применённую команду; ключ включает имя команды. */
  rememberCompletedCommand(gameId: string, commandKey: string): void {
    const now = Date.now()
    let commands = this.completedCommands.get(gameId)
    if (!commands) {
      commands = new Map()
      this.completedCommands.set(gameId, commands)
    }

    for (const [key, completedAt] of commands) {
      if (now - completedAt <= COMMAND_IDEMPOTENCY_TTL_MS) break
      commands.delete(key)
    }

    commands.delete(commandKey)
    commands.set(commandKey, now)
    while (commands.size > MAX_COMPLETED_COMMANDS_PER_GAME) {
      const oldestKey = commands.keys().next().value
      if (oldestKey === undefined) break
      commands.delete(oldestKey)
    }
  }

  /**
   * Изменение партии с откатом и сохранением — общий протокол для ходов
   * человека и ходов компьютера.
   *
   * Порядок один: снимок состояния → изменение → сохранение → публикация.
   * При ошибке изменения или записи состояние возвращается к снимку, поэтому
   * несохранённая правка не остаётся в партии и не расходится игрокам.
   *
   * Изменение может быть отменено ошибкой `MutationCancelled`: тогда
   * состояние откатывается и не сохраняется.
   */
  async mutateAndSave<T>(
    gameId: string,
    mutate: (game: GameManager) => Promise<T>,
    publish?: (game: GameManager, result: T) => void
  ): Promise<T> {
    const game = this.games[gameId]
    if (!game) throw new Error(CommonErrors.GameNotFound)

    const previousState = game.captureRollbackState()
    try {
      const result = await mutate(game)
      try {
        await this.saveGame(gameId)
      } catch (error) {
        throw new GameSaveError(gameId, error)
      }
      publish?.(game, result)
      return result
    } catch (error) {
      game.restoreRollbackState(previousState)
      throw error
    }
  }

  /**
   * Транзиентное изменение партии: состояние меняется в памяти и расходится
   * игрокам, но не сохраняется.
   *
   * Так меняется предпросмотр — поворот тайла и выбор клетки. На правила он не
   * влияет, поэтому переживать перезапуск сервера ему не нужно. Снимок
   * состояния не снимается: правка состоит из одной проверки и одного
   * присваивания, поэтому частичного изменения не бывает.
   */
  async mutateWithoutSaving<T>(
    gameId: string,
    mutate: (game: GameManager) => Promise<T>
  ): Promise<T> {
    const game = this.games[gameId]
    if (!game) throw new Error(CommonErrors.GameNotFound)

    return mutate(game)
  }

  /**
   * Сохранение партии с откатом: если запись не удалась, `restore` возвращает
   * состояние к прежнему виду, а ошибка поднимается дальше.
   *
   * Откатывается ровно то, что меняла команда: освобождение слота в лобби,
   * замену партии после старта или состояние хода.
   */
  async saveWithRollback(
    gameId: string,
    restore: () => void | Promise<void>
  ): Promise<void> {
    try {
      await this.saveGame(gameId)
    } catch (error) {
      await restore()
      throw error
    }
  }

  /**
   * Сбрасывает на диск всё, что ещё не записано.
   *
   * Новые сохранения могут начаться, пока идёт сброс: ход компьютера или
   * команда игроки. Поэтому очередь опустошается циклом, а не одним
   * ожиданием — иначе последняя запись осталась бы только в памяти.
   */
  async flushGames(): Promise<void> {
    const gameIds = this.allGames()
      .map((game) => game.id)
      .filter((gameId): gameId is string => Boolean(gameId))
    await Promise.all(gameIds.map((gameId) => this.saveGame(gameId)))
    // Пока идёт сброс, очередь может пополниться (ход компьютера, команда
    // игрока) — тогда цикл повторяется. Число кругов ограничено, чтобы
    // неисправность хранилища не превратила остановку сервера в вечное ожидание.
    for (let round = 0; round < FLUSH_MAX_ROUNDS; round += 1) {
      if (this.pendingSaves.size === 0) return
      await Promise.all([...this.pendingSaves.values()])
    }
    throw new Error('Pending game saves did not settle while flushing')
  }

  // ----------------------------------------------------------------- sessions

  /**
   * Принимает токен клиента или выдаёт новый. Подпись проверяется здесь, а не
   * в обработчике сокета: идентичность — часть доменного жизненного цикла.
   */
  resolveSession(token: string | undefined): {
    token: string
    sessionId: string
    isNew: boolean
  } {
    const sessionId = token
      ? verifySessionToken(token, this.sessionSecret)
      : undefined
    if (sessionId) return { token: token as string, sessionId, isNew: false }

    const issued = createSessionToken(this.sessionSecret)
    return { ...issued, isNew: true }
  }

  registerSession(sessionId: string, socketId: string): void {
    this.socketToSessionMap[socketId] = sessionId
  }

  getSessionBySocketId(socketId: string): string | undefined {
    return this.socketToSessionMap[socketId]
  }

  /** Забывает сокет при отключении: карта не должна расти бесконечно. */
  unregisterSocket(socketId: string): void {
    delete this.socketToSessionMap[socketId]
  }

  // ------------------------------------------------------------------ registry

  allGames(): GameManager[] {
    return Object.values(this.games)
  }

  getGame(gameId: string): GameManager | undefined {
    return this.games[gameId]
  }

  getGameByIdentifier(identifier: string): GameManager | undefined {
    const normalizedIdentifier = identifier.trim().toUpperCase()
    return (
      this.games[identifier] ??
      this.allGames().find(
        (game) => game.roomCode?.toUpperCase() === normalizedIdentifier
      )
    )
  }

  findPlayerGamesForSocket(socketId: string): GameManager[] {
    return this.allGames().filter((game) =>
      game.players.some((p) => p.socketId === socketId)
    )
  }

  async deleteGame(gameId: string): Promise<void> {
    const existingDeletion = this.pendingDeletions.get(gameId)
    if (existingDeletion) return existingDeletion

    // Убираем партию из реестра сразу: пока она там лежит, новый saveGame
    // встаёт в очередь после удаления и воскрешает запись в хранилище.
    const game = this.games[gameId]
    const owner = this.lobbyOwners[gameId]
    const summary = this.savedSummaries.get(gameId)
    delete this.games[gameId]
    delete this.lobbyOwners[gameId]
    this.savedSummaries.delete(gameId)

    // Удаление встаёт в ту же очередь, что и сохранения, поэтому выполняется
    // после всех них. Ошибка прошлого сохранения удалению не мешает.
    const previousSave = this.pendingSaves.get(gameId) ?? Promise.resolve()
    const deletion: Promise<void> = previousSave
      .catch(() => undefined)
      .then(async () => {
        await this.db.deleteGame(gameId)
        // Сохранение, начатое до удаления, могло завершиться уже после того,
        // как сводку убрали из кэша. Удаляем её ещё раз, иначе список лобби
        // навсегда сохранит ссылку на удалённую партию.
        this.savedSummaries.delete(gameId)
      })
      .catch((error: unknown) => {
        // Хранилище не удалило запись: возвращаем партию в память, иначе
        // после перезапуска она «воскреснет» из базы без живого состояния.
        if (game && !this.games[gameId]) this.games[gameId] = game
        if (owner && !this.lobbyOwners[gameId]) this.lobbyOwners[gameId] = owner
        if (summary && !this.savedSummaries.has(gameId)) {
          this.savedSummaries.set(gameId, summary)
        }
        throw error
      })
      .finally(() => {
        if (this.pendingSaves.get(gameId) === deletion) {
          this.pendingSaves.delete(gameId)
        }
        if (this.pendingDeletions.get(gameId) === deletion) {
          this.pendingDeletions.delete(gameId)
        }
      })
    this.pendingSaves.set(gameId, deletion)
    this.pendingDeletions.set(gameId, deletion)

    await deletion
    this.completedCommands.delete(gameId)
  }

  saveGame(gameId: string): Promise<void> {
    const game = this.games[gameId]
    if (!game) return Promise.resolve()
    if (game.id !== gameId) {
      return Promise.reject(new Error(SaveErrors.StorageKeyMismatch))
    }

    const depth = this.saveQueueDepth.get(gameId) ?? 0
    if (depth >= this.limits.maxPendingSavesPerGame) {
      return Promise.reject(new Error(CommonErrors.SaveFailed))
    }

    // Метку обновляем на живом объекте, а не только на снимке: по ней
    // cleanupGames отсеивает активные партии, а она не должна замерзать
    // после первого сохранения.
    game.lastUpdate = Date.now()
    // Сериализация сразу, а не глубокая копия: снимок для записи должен быть
    // неизменяемым к моменту, когда очередь сохранений дойдёт до хранилища.
    const serializedState: GameSavePayload = serializeGameState(game)
    const summary = readGameSummary(serializedState)
    const previousSave = this.pendingSaves.get(gameId) ?? Promise.resolve()
    this.saveQueueDepth.set(gameId, depth + 1)
    if (depth === 0) this.saveQueueSince.set(gameId, Date.now())

    const save = previousSave
      // Ошибка прошлой записи не должна блокировать следующую: хранилище могло
      // восстановиться, а новая команда заслуживает собственной попытки.
      .catch(() => undefined)
      .then(async () => {
        try {
          await this.db.saveGame(gameId, serializedState, summary)
          if (summary) this.savedSummaries.set(gameId, summary)
        } catch (error) {
          this.saveFailureCount += 1
          throw error
        }
      })
    const trackedSave = save.finally(() => {
      const remaining = (this.saveQueueDepth.get(gameId) ?? 1) - 1
      if (remaining <= 0) {
        this.saveQueueDepth.delete(gameId)
        this.saveQueueSince.delete(gameId)
      } else {
        this.saveQueueDepth.set(gameId, remaining)
      }
      if (this.pendingSaves.get(gameId) === trackedSave) {
        this.pendingSaves.delete(gameId)
      }
    })
    this.pendingSaves.set(gameId, trackedSave)
    return trackedSave
  }

  /** Причина отказа создать ещё одно лобби или `undefined`, если можно. */
  lobbyCreationError(sessionId: string): string | undefined {
    if (this.allGames().length >= this.limits.maxTotalGames) {
      return LobbyErrors.TooManyGames
    }

    const ownedLobbies = Object.entries(this.lobbyOwners).filter(
      ([gameId, ownerSessionId]) => {
        const game = this.games[gameId]
        return (
          ownerSessionId === sessionId &&
          game !== undefined &&
          !game.gameIsStarted
        )
      }
    ).length
    if (ownedLobbies >= this.limits.maxOwnedLobbies) {
      return LobbyErrors.TooManyOwnedLobbies
    }

    return undefined
  }

  /**
   * Причина отказа запустить ещё одну полностью автоматическую партию или
   * `undefined`, если можно.
   *
   * Партии с компьютерами не ждут команд человека: цепочка ходов ИИ занимает
   * цикл событий постоянно. Поэтому число одновременных таких партий ограничено
   * глобально и на сессию. Владелец известен по `lobbyOwners`; после перезапуска
   * сервера у автоматической партии владельца уже нет, но глобальный предел
   * продолжает её учитывать.
   */
  aiGameStartError(sessionId: string): string | undefined {
    const activeAiGames = this.allGames().filter(
      (game) =>
        game.gameIsStarted &&
        !game.gameIsEnded &&
        game.players.length > 0 &&
        game.players.every(isComputerPlayer)
    )

    if (activeAiGames.length >= this.limits.maxActiveAiGames) {
      return LobbyErrors.TooManyAiGames
    }

    const ownedAiGames = activeAiGames.filter(
      (game) => game.id && this.lobbyOwners[game.id] === sessionId
    ).length
    if (ownedAiGames >= this.limits.maxActiveAiGamesPerSession) {
      return LobbyErrors.TooManyOwnedAiGames
    }

    return undefined
  }

  createLobby(
    socketId: string,
    sessionId: string,
    options: GameOptions = {}
  ): GameManager & { id: string } {
    const gameId = globalThis.crypto.randomUUID()

    const players: Player[] = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      socketId: i === 0 ? socketId : null,
      sessionId: i === 0 ? sessionId : null,
      name: i === 0 ? playerNameForIndex(i) : '',
      color: playerColorForIndex(i),
      score: 0,
    }))

    const game = new GameManager({
      players,
      startImmediately: false,
      ...options,
    })
    game.id = gameId
    game.roomCode = this.createUniqueRoomCode()
    game.ownerSessionId = sessionId
    this.games[gameId] = game
    this.lobbyOwners[gameId] = sessionId
    return game as GameManager & { id: string }
  }

  // ------------------------------------------------------------------ players

  addPlayer(
    gameId: string,
    index: number,
    params: { name: string | null; socketId: string; sessionId: string }
  ) {
    const player = this.games[gameId]?.players[index]
    if (!player) return

    if (params.name) {
      player.name = params.name
      player.socketId = params.socketId
      player.sessionId = params.sessionId
    } else {
      player.name = playerNameForIndex(index)
    }
  }

  /** Занято ли имя другим слотом; сравнение без учёта регистра и «ё». */
  isPlayerNameTaken(
    gameId: string,
    name: string,
    ignoreIndex: number
  ): boolean {
    const game = this.games[gameId]
    if (!game || !name) return false
    const key = playerNameKey(name)
    return game.players.some(
      (player, index) =>
        index !== ignoreIndex &&
        Boolean(player.name) &&
        playerNameKey(player.name ?? '') === key
    )
  }

  canEditLobbySlot(
    gameId: string,
    socketId: string,
    sessionId: string,
    index: number
  ): boolean {
    const game = this.games[gameId]
    if (!game || game.gameIsStarted || !Number.isInteger(index)) return false

    const targetPlayer = game.players[index]
    if (!targetPlayer) return false

    const isOwner = this.lobbyOwners[gameId] === sessionId
    return isOwner || targetPlayer.socketId === socketId
  }

  canStartLobby(gameId: string, sessionId: string): boolean {
    const game = this.games[gameId]
    if (!game || game.gameIsStarted) return false
    return this.lobbyOwners[gameId] === sessionId
  }

  removePlayer(gameId: string, index: number, keepAsComputer: boolean) {
    const player = this.games[gameId]?.players[index]
    if (!player) return

    if (keepAsComputer) {
      player.name = playerNameForIndex(index)
      player.socketId = null
      player.sessionId = null
    } else {
      player.socketId = null
      player.sessionId = null
      player.name = ''
    }
  }

  joinFirstFreeSlot(
    gameId: string,
    socketId: string,
    sessionId: string
  ): JoinResult | { game: GameManager; playerIndex: number } {
    const game = this.games[gameId]
    if (!game) return { error: CommonErrors.GameNotFound }
    if (game.gameIsStarted) return { error: LobbyErrors.GameAlreadyStarted }
    if (game.players.some((player) => player.socketId === socketId)) {
      return { error: LobbyErrors.AlreadyJoinedGame }
    }
    if (game.players.every((p) => p.socketId)) {
      return { error: LobbyErrors.AllSlotsTaken }
    }

    const playerIndex = game.players.findIndex(
      (p) => !p.socketId && !p.sessionId
    )
    if (playerIndex === -1) {
      return { error: LobbyErrors.AllSlotsTaken }
    }

    const player = game.players[playerIndex]
    player.name = playerNameForIndex(playerIndex)
    player.socketId = socketId
    player.sessionId = sessionId

    return { game, playerIndex }
  }

  startGame(gameId: string): GameManager | undefined {
    const game = this.games[gameId]
    if (!game) return undefined

    const activePlayers = game.players.filter((p) => Boolean(p.name))
    const newGame = new GameManager({
      players: activePlayers,
      finalScoringEnabled: game.finalScoringEnabled,
      ...expansionOptionsFromRules(game.rules),
    })
    newGame.id = gameId
    newGame.roomCode = game.roomCode
    newGame.ownerSessionId =
      this.lobbyOwners[gameId] ?? game.ownerSessionId ?? null
    this.games[gameId] = newGame
    return newGame
  }

  // ------------------------------------------------------------------ disconnect

  hasOtherConnectedPlayers(game: GameManager, socketId: string): boolean {
    return game.players.some((p) => p.socketId && p.socketId !== socketId)
  }

  /**
   * Освобождает сокет игрока в партии.
   *
   * Что делать с сессией игрока, задаёт `sessionId`:
   * `undefined` — оставить сессию как есть (забыт только сокет),
   * `null` — забыть сессию (слот освобождён целиком),
   * строка — запомнить указанную сессию.
   */
  releasePlayer(gameId: string, socketId: string, sessionId?: string | null) {
    const game = this.games[gameId]
    if (!game) return

    game.players = game.players.map((player) => {
      if (player.socketId !== socketId) return player
      player.socketId = null
      if (sessionId !== undefined) player.sessionId = sessionId
      return player
    })
  }

  /**
   * Передаёт права владельца незапущенного лобби следующему оставшемуся
   * игроку. Если игроков нет, владелец просто снимается.
   */
  /** Восстанавливает владельца при откате лобби. */
  setLobbyOwner(gameId: string, sessionId: string | null): void {
    const game = this.games[gameId]
    if (game) game.ownerSessionId = sessionId
    if (sessionId) {
      this.lobbyOwners[gameId] = sessionId
    } else {
      delete this.lobbyOwners[gameId]
    }
  }

  reassignLobbyOwner(gameId: string): string | null {
    const game = this.games[gameId]
    if (!game || game.gameIsStarted) {
      return this.lobbyOwners[gameId] ?? null
    }

    const nextOwner = game.players.find((player) => player.sessionId)
    const sessionId = nextOwner?.sessionId ?? null
    if (sessionId) {
      this.lobbyOwners[gameId] = sessionId
    } else {
      delete this.lobbyOwners[gameId]
    }
    game.ownerSessionId = sessionId
    return sessionId
  }

  rejoinGame(
    gameId: string,
    sessionId: string,
    socketId: string
  ): { game: GameManager; players: Player[] } | null {
    const game = this.games[gameId]
    if (!game) return null

    const players = game.players.filter((p) => p.sessionId === sessionId)

    if (players.length > 0) {
      game.players.forEach((player) => {
        if (player.sessionId !== sessionId) return
        player.socketId = socketId
        if (game.currentPlayer && player.id === game.currentPlayer.id) {
          game.currentPlayer.socketId = socketId
          game.currentPlayer.sessionId = sessionId
        }
      })
    }

    return { game, players }
  }

  // ------------------------------------------------------------------ persistence

  /**
   * Восстанавливает из хранилища только незавершённые партии.
   *
   * Завершённую партию игрок открывает редко, поэтому её состояние
   * загружается лениво в `resolveGame()`. Список лобби и так берёт сводки из
   * отдельного индекса и не требует разбора доски.
   *
   * Нормализацию состояния целиком делает `deserializeGameState`: правила,
   * сады, пулы подданных и список лидеров нормализуются там же, где проверяются.
   * Дублировать эти значения здесь нельзя — расхождение двух дефолтов уже
   * стоило игроку одного большого подданного при включённом расширении.
   *
   * Нечитаемые сохранения не роняют загрузку, но и не теряются молча: их
   * количество попадает в счётчик и в журнал.
   */
  async loadSavedGames(): Promise<void> {
    let { summaries, unreadable } = await this.db.getGameSummaries()

    // Пустой индекс в старом хранилище означает, что сводок ещё нет. Если же
    // хранилище вернуло нечитаемые записи, это уже его собственный счётчик:
    // повторный разбор всех сохранений только удвоил бы число отказов.
    if (summaries.length === 0 && unreadable === 0) {
      const migrated = await this.migrateSavedGameSummaries()
      summaries = migrated.summaries
      unreadable += migrated.unreadable
    }

    this.savedSummaries.clear()
    summaries.forEach((summary) => {
      this.savedSummaries.set(summary.id, summary)
    })

    const failures: Array<{ reason: string }> = []
    for (const summary of summaries) {
      // Конец партии почти всегда означает архив: читать его при старте
      // сервера дороже, чем при одном открытии результата.
      if (summary.gameIsEnded) continue
      try {
        await this.hydrateSavedGame(summary)
      } catch (error) {
        failures.push({ reason: getErrorMessage(error) })
      }
    }

    this.unreadableSaves = unreadable + failures.length
    if (failures.length) {
      logger.error(
        `Ignoring ${failures.length} invalid saved game(s):`,
        failures
      )
    }
  }

  /**
   * Возвращает партию по id или коду комнаты, при необходимости загружая
   * сохранение в память. Нужен для старых завершённых партий: в реестре при
   * старте их нет.
   */
  async resolveGame(identifier: string): Promise<GameManager | undefined> {
    const loaded = this.getGameByIdentifier(identifier)
    if (loaded) return loaded

    const normalizedIdentifier = identifier.trim().toUpperCase()
    const summary = [...this.savedSummaries.values()].find(
      (candidate) =>
        candidate.id === identifier ||
        candidate.roomCode?.toUpperCase() === normalizedIdentifier
    )
    if (!summary) return undefined

    const pending = this.pendingHydrations.get(summary.id)
    if (pending) return pending

    const hydration: Promise<GameManager | undefined> = this.hydrateSavedGame(
      summary
    ).finally(() => {
      if (this.pendingHydrations.get(summary.id) === hydration) {
        this.pendingHydrations.delete(summary.id)
      }
    })
    this.pendingHydrations.set(summary.id, hydration)
    return hydration
  }

  private async hydrateSavedGame(
    summary: GameSummaryRecord
  ): Promise<GameManager | undefined> {
    const savedGame = await this.db.getGame(summary.id)
    if (!savedGame) {
      // Сводка осталась без состояния: убираем обе записи, иначе «мёртвая»
      // комната будет вечно висеть в списке.
      await this.deleteGame(summary.id)
      return undefined
    }

    const game = GameManager.restore(savedGame)
    const gameId = game.id
    if (!gameId) {
      await this.deleteGame(summary.id)
      return undefined
    }

    game.players.forEach((player) => {
      player.socketId = null
    })
    if (game.currentPlayer) game.currentPlayer.socketId = null

    const owner = game.players.find((player) => player.sessionId)
    game.ownerSessionId = owner?.sessionId ?? null
    if (owner?.sessionId) {
      this.lobbyOwners[gameId] = owner.sessionId
    }

    if (!game.roomCode || this.isRoomCodeTakenByOther(game.roomCode, gameId)) {
      game.roomCode = this.createUniqueRoomCode()
    }

    this.games[gameId] = game
    if (game.roomCode !== summary.roomCode) {
      await this.saveGame(gameId)
    }
    return game
  }

  private async migrateSavedGameSummaries(): Promise<{
    summaries: GameSummaryRecord[]
    unreadable: number
  }> {
    const rawSaves = await this.db.getAllGameSaves()
    const summaries: GameSummaryRecord[] = []
    let unreadable = 0

    for (const rawSave of rawSaves) {
      const summary = readGameSummary(rawSave)
      if (summary) summaries.push(summary)
      else unreadable += 1
    }

    if (summaries.length > 0) {
      await this.db.saveGameSummaries(summaries)
    }
    return { summaries, unreadable }
  }

  private createUniqueRoomCode(existingCodes?: Set<string>): string {
    const codes =
      existingCodes ??
      new Set(
        [
          ...this.allGames().map((game) => game.roomCode),
          ...[...this.savedSummaries.values()].map(
            (summary) => summary.roomCode
          ),
        ].filter((code): code is string => Boolean(code))
      )
    let roomCode: string
    do {
      roomCode = String(randomInt(100_000, 1_000_000))
    } while (codes.has(roomCode))
    codes.add(roomCode)
    return roomCode
  }

  private isRoomCodeTakenByOther(roomCode: string, gameId: string): boolean {
    return (
      this.allGames().some(
        (game) => game.id !== gameId && game.roomCode === roomCode
      ) ||
      [...this.savedSummaries.values()].some(
        (summary) => summary.id !== gameId && summary.roomCode === roomCode
      )
    )
  }

  /**
   * Удаляет заброшенные и просроченные партии.
   *
   * Активная партия удаляется только когда в ней нет подключённых людей:
   * пока кто-то в сети, это не заброшенная комната, а просто пауза.
   * Завершённые партии удаляются по сроку хранения независимо от сокетов.
   */
  async cleanupGames(options: GameCleanupOptions): Promise<DeletedGameInfo[]> {
    const deleted: DeletedGameInfo[] = []
    const now = Date.now()

    // Завершённые партии при старте не загружаются, поэтому срок хранения
    // проверяется по сводкам: иначе архив в хранилище рос бы бесконечно.
    for (const [gameId, summary] of [...this.savedSummaries]) {
      if (!summary.gameIsEnded) continue
      const lastUpdate = summary.lastUpdate ?? 0
      if (!lastUpdate || now - lastUpdate <= options.finishedRetentionMs) {
        continue
      }
      logger.info('Deleting expired game:', gameId)
      await this.deleteGame(gameId)
      deleted.push({ gameId, reason: 'expired' })
    }

    for (const [gameId, game] of Object.entries(this.games)) {
      if (!game.lastUpdate) game.lastUpdate = now
      const age = now - game.lastUpdate

      if (game.gameIsEnded) {
        if (age <= options.finishedRetentionMs) continue
        logger.info('Deleting expired game:', gameId)
        await this.deleteGame(gameId)
        deleted.push({ gameId, reason: 'expired' })
        continue
      }

      if (!game.gameIsStarted) continue
      if (game.players.some((player) => player.socketId)) continue
      if (age <= options.abandonedTimeoutMs) continue

      logger.info('Deleting abandoned game:', gameId)
      await this.deleteGame(gameId)
      deleted.push({ gameId, reason: 'stale' })
    }

    return deleted
  }

  formatGamesList(games: GameManager[] = this.allGames()): GameSummary[] {
    const memoryIds = new Set(games.map((game) => game.id))
    const summaries: GameSummary[] = games.map((game) => toGameSummary(game))
    for (const savedSummary of this.savedSummaries.values()) {
      if (memoryIds.has(savedSummary.id)) continue
      summaries.push(toGameSummary(savedSummary))
    }
    return sortGameSummaries(summaries)
  }

  /** Сведения о состоянии хранилища для health-endpoint. */
  storageStatus(): StorageStatus {
    const pendingSaveOperations = [...this.saveQueueDepth.values()].reduce(
      (total, depth) => total + depth,
      0
    )
    const oldestSaveSince = this.saveQueueSince.size
      ? Math.min(...this.saveQueueSince.values())
      : null

    return {
      games: Object.keys(this.games).length,
      pendingSaves: this.pendingSaves.size,
      pendingSaveOperations,
      oldestSaveAgeMs:
        oldestSaveSince === null ? 0 : Date.now() - oldestSaveSince,
      saveFailures: this.saveFailureCount,
      pendingCommands: this.gameCommands.size,
      unreadableSaves: this.unreadableSaves,
    }
  }

  /**
   * Список игр: живые партии, дополненные сохранёнными сводками.
   *
   * В хранилище не ходим: заголовки уже лежат в памяти и обновляются при
   * каждом сохранении. Иначе каждый вход клиента читал бы весь индекс.
   */
  async getGameSummaries(): Promise<GameSummary[]> {
    return this.formatGamesList()
  }
}
