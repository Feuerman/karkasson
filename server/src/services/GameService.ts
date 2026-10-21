import { GameManager } from '../modules/GameManager'
import { deserializeGameState, serializeGameState } from '../modules/gameSave'
import type { GameSavePayload, IGameDatabase } from '../modules/Database'
import {
  CommonErrors,
  GameSaveError,
  LobbyErrors,
  SaveErrors,
} from '../modules/errors'
import { randomInt } from 'node:crypto'
import { getErrorMessage } from '../utils/common'
import { createLogger } from '../utils/logger'
import { ComputerMoveScheduler } from './computerPlayer'
import {
  sortGameSummaries,
  toGameSummary,
  type GameSummary,
} from './gameSummary'
import {
  playerColorForIndex,
  playerNameForIndex,
  expansionOptionsFromRules,
  type GameOptions,
  type Player,
} from '../modules/types'

export type { GameData } from './gameView'
export type { GameSummary, GameSummaryPlayer } from './gameSummary'

const logger = createLogger('GameService')

export interface JoinResult {
  error: string
}

/**
 * ����������� ��������� ���������: ������� ������ � ������, ��� ��� ��
 * �������� � ������� ���������� �� ������� ���������. ��������� ��������
 * ������� ��� �� ������� �� ����� �������� � ����������.
 */
export interface StorageStatus {
  games: number
  pendingSaves: number
  pendingCommands: number
  unreadableSaves: number
}

/** ������� ��� ����� ����� ��������� �������� ������� ����������. */
const FLUSH_MAX_ROUNDS = 8

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
  private deviceToSocketMap: Record<string, string> = {}
  /** Обратная карта: сокет → устройство. Заполняется при регистрации. */
  private socketToDeviceMap: Record<string, string> = {}
  private lobbyOwners: Record<string, string> = {}
  private readonly pendingSaves = new Map<string, Promise<void>>()
  private readonly gameCommands = new Map<string, { tail: Promise<void> }>()
  /** Сколько сохранений не удалось прочитать при последней загрузке. */
  private unreadableSaves = 0

  constructor(private readonly db: IGameDatabase) {}

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

  // ------------------------------------------------------------------ devices

  registerDevice(deviceId: string, socketId: string) {
    this.deviceToSocketMap[deviceId] = socketId
    // Первый зарегистрированный сокет для устройства остаётся и в обратной
    // карте: так поиск по сокету ведёт себя так же, как поиск перебором.
    if (!this.socketToDeviceMap[socketId]) {
      this.socketToDeviceMap[socketId] = deviceId
    }
  }

  getDeviceBySocketId(socketId: string): string | undefined {
    return this.socketToDeviceMap[socketId]
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
    // Убираем партию из реестра сразу: пока она там лежит, новый saveGame
    // встаёт в очередь после удаления и воскрешает запись в хранилище.
    delete this.games[gameId]
    delete this.lobbyOwners[gameId]

    // Удаление встаёт в ту же очередь, что и сохранения, поэтому выполняется
    // после всех них. Ошибка прошлого сохранения удалению не мешает.
    const previousSave = this.pendingSaves.get(gameId) ?? Promise.resolve()
    const deletion: Promise<void> = previousSave
      .catch(() => undefined)
      .then(() => this.db.deleteGame(gameId))
      .finally(() => {
        if (this.pendingSaves.get(gameId) === deletion) {
          this.pendingSaves.delete(gameId)
        }
      })
    this.pendingSaves.set(gameId, deletion)

    await deletion
  }

  saveGame(gameId: string): Promise<void> {
    const game = this.games[gameId]
    if (!game) return Promise.resolve()
    if (game.id !== gameId) {
      return Promise.reject(new Error(SaveErrors.StorageKeyMismatch))
    }
    // Метку обновляем на живом объекте, а не только на снимке: по ней
    // deleteStaleGames отсеивает активные партии, а она не должна замерзать
    // после первого сохранения.
    game.lastUpdate = Date.now()
    // Сериализация сразу, а не глубокая копия: снимок для записи должен быть
    // неизменяемым к моменту, когда очередь сохранений дойдёт до хранилища.
    const serializedState: GameSavePayload = serializeGameState(game)
    const previousSave = this.pendingSaves.get(gameId) ?? Promise.resolve()
    const save = previousSave.then(() =>
      this.db.saveGame(gameId, serializedState)
    )
    const trackedSave = save.finally(() => {
      if (this.pendingSaves.get(gameId) === trackedSave) {
        this.pendingSaves.delete(gameId)
      }
    })
    this.pendingSaves.set(gameId, trackedSave)
    return trackedSave
  }

  createLobby(
    socketId: string,
    options: GameOptions = {}
  ): GameManager & { id: string } {
    const gameId = globalThis.crypto.randomUUID()
    const deviceId = this.getDeviceBySocketId(socketId)

    const players: Player[] = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      socketId: i === 0 ? socketId : null,
      deviceId: i === 0 ? (deviceId ?? null) : null,
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
    this.games[gameId] = game
    this.lobbyOwners[gameId] = deviceId ?? socketId
    return game as GameManager & { id: string }
  }

  // ------------------------------------------------------------------ players

  addPlayer(
    gameId: string,
    index: number,
    params: { name: string | null; socketId: string; deviceId?: string }
  ) {
    const player = this.games[gameId]?.players[index]
    if (!player) return

    if (params.name) {
      player.name = params.name
      player.socketId = params.socketId
      player.deviceId = params.deviceId ?? null
    } else {
      player.name = playerNameForIndex(index)
    }
  }

  canEditLobbySlot(gameId: string, socketId: string, index: number): boolean {
    const game = this.games[gameId]
    if (!game || game.gameIsStarted || !Number.isInteger(index)) return false

    const targetPlayer = game.players[index]
    if (!targetPlayer) return false

    const ownerId = this.lobbyOwners[gameId]
    const isOwner =
      ownerId === socketId || ownerId === this.getDeviceBySocketId(socketId)
    return isOwner || targetPlayer.socketId === socketId
  }

  canStartLobby(gameId: string, socketId: string): boolean {
    const game = this.games[gameId]
    if (!game || game.gameIsStarted) return false
    const ownerId = this.lobbyOwners[gameId]
    return (
      ownerId === socketId || ownerId === this.getDeviceBySocketId(socketId)
    )
  }

  removePlayer(gameId: string, index: number, keepAsComputer: boolean) {
    const player = this.games[gameId]?.players[index]
    if (!player) return

    if (keepAsComputer) {
      player.name = playerNameForIndex(index)
      player.socketId = null
      player.deviceId = null
    } else {
      player.socketId = null
      player.deviceId = null
      player.name = ''
    }
  }

  joinFirstFreeSlot(
    gameId: string,
    socketId: string,
    deviceId?: string
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
      (p) => !p.socketId && !p.deviceId
    )
    if (playerIndex === -1) {
      return { error: LobbyErrors.AllSlotsTaken }
    }

    const player = game.players[playerIndex]
    player.name = playerNameForIndex(playerIndex)
    player.socketId = socketId
    player.deviceId = deviceId ?? null

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
   * Что делать с устройством игрока, задаёт `deviceId`:
   * `undefined` — оставить устройство как есть (забыт только сокет),
   * `null` — забыть устройство (слот освобождён целиком),
   * строка — запомнить указанное устройство.
   */
  releasePlayer(gameId: string, socketId: string, deviceId?: string | null) {
    const game = this.games[gameId]
    if (!game) return

    game.players = game.players.map((player) => {
      if (player.socketId !== socketId) return player
      player.socketId = null
      if (deviceId !== undefined) player.deviceId = deviceId
      return player
    })
  }

  rejoinGame(
    gameId: string,
    deviceId: string,
    socketId: string
  ): { game: GameManager; players: Player[] } | null {
    const game = this.games[gameId]
    if (!game) return null

    const players = game.players.filter((p) => p.deviceId === deviceId)

    if (players.length > 0) {
      game.players.forEach((player) => {
        if (player.deviceId !== deviceId) return
        player.socketId = socketId
        if (game.currentPlayer && player.id === game.currentPlayer.id) {
          game.currentPlayer.socketId = socketId
        }
      })
    }

    return { game, players }
  }

  // ------------------------------------------------------------------ persistence

  /**
   * Восстанавливает партии из хранилища.
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
    const rawSaves = await this.db.getAllGameSaves()
    const updatedGameIds: string[] = []
    const failures: Array<{ reason: string }> = []
    // Коды комнат собираются один раз: пересборка на каждую партию делала
    // загрузку сохранений квадратичной.
    const roomCodes = new Set(
      this.allGames()
        .map((game) => game.roomCode)
        .filter((code): code is string => Boolean(code))
    )

    rawSaves.forEach((rawSave) => {
      try {
        const savedGame = deserializeGameState(rawSave)
        const gameId = savedGame.id
        if (!gameId) return

        const game = GameManager.restore(savedGame)
        if (!game.roomCode || roomCodes.has(game.roomCode)) {
          game.roomCode = this.createUniqueRoomCode(roomCodes)
          updatedGameIds.push(gameId)
        }
        if (game.roomCode) roomCodes.add(game.roomCode)
        const owner = game.players.find((player) => player.socketId)
        if (owner?.socketId) {
          this.lobbyOwners[gameId] = owner.deviceId ?? owner.socketId
        }
        game.players.forEach((player) => {
          player.socketId = null
        })
        if (game.currentPlayer) game.currentPlayer.socketId = null
        this.games[gameId] = game
      } catch (error) {
        failures.push({ reason: getErrorMessage(error) })
      }
    })

    this.unreadableSaves = failures.length
    if (failures.length) {
      logger.error(
        `Ignoring ${failures.length} invalid saved game(s):`,
        failures
      )
    }

    await Promise.all(updatedGameIds.map((gameId) => this.saveGame(gameId)))
  }

  private createUniqueRoomCode(existingCodes?: Set<string>): string {
    const codes =
      existingCodes ??
      new Set(
        this.allGames()
          .map((game) => game.roomCode)
          .filter((code): code is string => Boolean(code))
      )
    let roomCode: string
    do {
      roomCode = String(randomInt(100_000, 1_000_000))
    } while (codes.has(roomCode))
    codes.add(roomCode)
    return roomCode
  }

  /** Удаляет игры, которые не обновлялись дольше указанного времени */
  async deleteStaleGames(timeoutMs: number): Promise<string[]> {
    const deletedGameIds: string[] = []

    for (const [gameId, game] of Object.entries(this.games)) {
      if (!game.gameIsStarted || game.gameIsEnded) continue

      if (!game.lastUpdate) {
        game.lastUpdate = Date.now()
      }
      if (Date.now() - game.lastUpdate > timeoutMs) {
        logger.info('Deleting stale game:', gameId)
        await this.deleteGame(gameId)
        deletedGameIds.push(gameId)
      }
    }

    return deletedGameIds
  }

  formatGamesList(games: GameManager[] = this.allGames()): GameSummary[] {
    return sortGameSummaries(games.map((game) => toGameSummary(game)))
  }

  /** Сведения о состоянии хранилища для health-endpoint. */
  storageStatus(): StorageStatus {
    return {
      games: Object.keys(this.games).length,
      pendingSaves: this.pendingSaves.size,
      pendingCommands: this.gameCommands.size,
      unreadableSaves: this.unreadableSaves,
    }
  }

  /**
   * Список игр: сохранённые из базы, дополненные играми из памяти.
   *
   * Из хранилища берутся сводки, а не состояния целиком: список запрашивается
   * при каждом входе клиента, а полный разбор сохранения запускает проверки и
   * миграцию всех тайлов и объектов доски заново.
   */
  async getGameSummaries(): Promise<GameSummary[]> {
    const memoryGames = this.allGames()
    const savedSummaries = await this.db.getGameSummaries()
    const memoryIds = new Set(memoryGames.map((game) => game.id))
    const mergedGames: GameSummary[] = memoryGames.map((game) =>
      toGameSummary(game)
    )

    savedSummaries.forEach((savedSummary) => {
      if (memoryIds.has(savedSummary.id)) return
      mergedGames.push(toGameSummary(savedSummary))
    })

    return sortGameSummaries(mergedGames)
  }
}
