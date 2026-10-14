import { GameManager, type IGameBoard } from '../modules/GameManager'
import type { IGameState } from '../modules/gameState'
import { deserializeGameState, serializeGameState } from '../modules/gameSave'
import type { GameSavePayload, IGameDatabase } from '../modules/Database'
import { CommonErrors, LobbyErrors, SaveErrors } from '../modules/errors'
import { randomInt } from 'node:crypto'
import { getErrorMessage } from '../utils/common'
import {
  playerColorForIndex,
  playerNameForIndex,
  type AbbotRecallInfo,
  type FollowerType,
  type Player,
  type PlayerId,
  type GameRules,
  type Scores,
} from '../modules/types'

export interface GameSummaryPlayer {
  id: PlayerId
  name: string | null
  color: string | null
  socketId: string | null
  deviceId: string | null
}

export interface GameSummary {
  id: string | undefined
  roomCode: string
  players: GameSummaryPlayer[]
  currentPlayer: PlayerId | null
  gameIsEnded: boolean
  moveCounter: number
  scores: Scores
  gameIsStarted: boolean
  lastUpdate: number
  rules: GameRules
}

export interface GameData {
  placingPoint?: IGameBoard['placingPoint']
  tilePlacesStats: IGameBoard['tilePlacesStats']
  tilesList: IGameBoard['tilesList']
  dragonMove?: IGameBoard['dragonMove']
  princessChoice?: IGameBoard['princessChoice']
  princessFollowerPenalty?: IGameBoard['princessFollowerPenalty']
  dragonPosition?: IGameBoard['dragonPosition']
  currentTile: IGameBoard['currentTile']
  players: Player[]
  currentPlayerIndex: number
  availableFollowersPlaces: IGameBoard['availableFollowersPlaces']
  /** Типы фишек, доступные в каждом месте, по id объекта. */
  availableFollowerTypes: Record<string, FollowerType[]>
  /** Что даст отзыв аббата текущему игроку, либо `null`. */
  abbotRecall: AbbotRecallInfo | null
  gameIsEnded: boolean
  finalScoringEnabled: boolean
  rules: GameRules
  moveCounter: number
  id: string | undefined
  roomCode?: string
  isPlacingFollower: boolean
  scores: Scores
  gameIsStarted: boolean
  gridSize: number[]
  completedObjects: IGameBoard['completedObjects']
  temporaryObjects: IGameBoard['temporaryObjects']
  lastPlacement: IGameBoard['lastPlacement']
  availablePlacesTiles: IGameBoard['availablePlacesTiles']
  playersFollowers: IGameBoard['playersFollowers']
  actionsHistory: IGameBoard['actionsHistory']
  currentPlayer: Player | null
  placedFollowers: IGameBoard['placedFollowers']
  winnerPlayerIds: IGameBoard['winnerPlayerIds']
  lastUpdate: number
}

export interface JoinResult {
  error: string
}

/**
 * Наблюдаемое состояние хранилища: сколько партий в памяти, что ещё не
 * записано и сколько сохранений не удалось прочитать. Позволяет отличить
 * «сервер жив» от «сервер не может работать с хранилищем».
 */
export interface StorageStatus {
  games: number
  pendingSaves: number
  pendingCommands: number
  unreadableSaves: number
}

/** Сколько раз сброс может повторить ожидание очереди сохранений. */
const FLUSH_MAX_ROUNDS = 8

function ignoreResult(): void {}

/**
 * Источник сведений о партии для списка лобби: живая партия либо сводка,
 * прочитанная из хранилища без полного разбора.
 */
type GameSummarySource = Partial<
  Pick<
    IGameState,
    | 'roomCode'
    | 'players'
    | 'currentPlayer'
    | 'gameIsEnded'
    | 'moveCounter'
    | 'scores'
    | 'gameIsStarted'
    | 'lastUpdate'
    | 'rules'
  >
> & { id?: string }

function toGameSummary(game: GameSummarySource): GameSummary {
  return {
    id: game.id,
    roomCode: game.roomCode ?? '',
    players: (game.players ?? []).map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      socketId: player.socketId,
      deviceId: player.deviceId,
    })),
    currentPlayer: game.currentPlayer?.id ?? null,
    gameIsEnded: game.gameIsEnded ?? false,
    moveCounter: game.moveCounter ?? 0,
    scores: game.scores ?? {},
    gameIsStarted: game.gameIsStarted ?? false,
    lastUpdate: game.lastUpdate ?? 0,
    rules: game.rules ?? {
      finalScoringEnabled: false,
      expansions: {
        innsAndCathedrals: false,
        river: false,
        princessAndDragon: false,
      },
    },
  }
}

/** Завершённые партии вперёд, среди них — самые свежие. */
function sortGameSummaries(games: GameSummary[]): GameSummary[] {
  return [...games].sort((left, right) => {
    if (left.gameIsEnded !== right.gameIsEnded) {
      return left.gameIsEnded ? -1 : 1
    }
    if (left.gameIsEnded) return right.lastUpdate - left.lastUpdate
    return 0
  })
}

/**
 * Хранит игры в памяти и содержит всю логику лобби/жизненного цикла игры.
 * Не знает про socket.io — рассылку событий делают обработчики сокетов.
 */
export class GameService {
  private games: Record<string, IGameBoard> = {}
  private deviceToSocketMap: Record<string, string> = {}
  private lobbyOwners: Record<string, string> = {}
  private readonly pendingSaves = new Map<string, Promise<void>>()
  private readonly gameCommands = new Map<string, { tail: Promise<void> }>()
  /** Сколько сохранений не удалось прочитать при последней загрузке. */
  private unreadableSaves = 0

  constructor(private readonly db: IGameDatabase) {}

  restoreGame(gameId: string, game: IGameBoard): void {
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
  }

  getDeviceBySocketId(socketId: string): string | undefined {
    return Object.entries(this.deviceToSocketMap).find(
      ([, sid]) => sid === socketId
    )?.[0]
  }

  // ------------------------------------------------------------------ registry

  allGames(): IGameBoard[] {
    return Object.values(this.games)
  }

  getGame(gameId: string): IGameBoard | undefined {
    return this.games[gameId]
  }

  getGameByIdentifier(identifier: string): IGameBoard | undefined {
    const normalizedIdentifier = identifier.trim().toUpperCase()
    return (
      this.games[identifier] ??
      this.allGames().find(
        (game) => game.roomCode?.toUpperCase() === normalizedIdentifier
      )
    )
  }

  findPlayerGamesForSocket(socketId: string): IGameBoard[] {
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
    options: {
      finalScoringEnabled?: boolean
      innsAndCathedralsEnabled?: boolean
      riverEnabled?: boolean
      princessAndDragonEnabled?: boolean
    } = {}
  ): IGameBoard & { id: string } {
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
      finalScoringEnabled: options.finalScoringEnabled,
      innsAndCathedralsEnabled: options.innsAndCathedralsEnabled,
      riverEnabled: options.riverEnabled,
      princessAndDragonEnabled: options.princessAndDragonEnabled,
    })
    game.id = gameId
    game.roomCode = this.createUniqueRoomCode()
    this.games[gameId] = game
    this.lobbyOwners[gameId] = deviceId ?? socketId
    return game as IGameBoard & { id: string }
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
  ): JoinResult | { game: IGameBoard; playerIndex: number } {
    const game = this.games[gameId]
    if (!game) return { error: CommonErrors.GameNotFound }
    if (game.gameIsStarted) return { error: 'Игра уже началась' }
    if (game.players.some((player) => player.socketId === socketId)) {
      return { error: 'Вы уже присоединились к игре' }
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

  startGame(gameId: string): IGameBoard | undefined {
    const game = this.games[gameId]
    if (!game) return undefined

    const activePlayers = game.players.filter((p) => Boolean(p.name))
    const newGame = new GameManager({
      players: activePlayers,
      finalScoringEnabled: game.finalScoringEnabled,
      innsAndCathedralsEnabled:
        game.rules?.expansions?.innsAndCathedrals ?? false,
      riverEnabled: game.rules?.expansions?.river ?? false,
      princessAndDragonEnabled:
        game.rules?.expansions?.princessAndDragon ?? false,
    })
    newGame.id = gameId
    newGame.roomCode = game.roomCode
    this.games[gameId] = newGame
    return newGame
  }

  // ------------------------------------------------------------------ disconnect

  hasOtherConnectedPlayers(game: IGameBoard, socketId: string): boolean {
    return game.players.some((p) => p.socketId && p.socketId !== socketId)
  }

  /** Игрок отключился временно: слот освобождается, но помним его deviceId */
  releasePlayerToDevice(gameId: string, socketId: string, deviceId?: string) {
    const game = this.games[gameId]
    if (!game) return

    game.players = game.players.map((p) => {
      if (p.socketId !== socketId) return p
      p.socketId = null
      p.deviceId = deviceId ?? null
      return p
    })
  }

  /** Полностью освободить слот лобби (и socket, и device) */
  releasePlayerSlot(gameId: string, socketId: string) {
    const game = this.games[gameId]
    if (!game) return

    game.players = game.players.map((p) => {
      if (p.socketId !== socketId) return p
      p.socketId = null
      p.deviceId = null
      return p
    })
  }

  /** Явное отключение в начатой игре: забываем только socket, device сохраняем */
  clearPlayerSocket(gameId: string, socketId: string) {
    const game = this.games[gameId]
    if (!game) return

    game.players = game.players.map((p) => {
      if (p.socketId !== socketId) return p
      p.socketId = null
      return p
    })
  }

  rejoinGame(
    gameId: string,
    deviceId: string,
    socketId: string
  ): { game: IGameBoard; players: Player[] } | null {
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

    rawSaves.forEach((rawSave) => {
      try {
        const savedGame = deserializeGameState(rawSave)
        const gameId = savedGame.id
        if (!gameId) return

        const game = GameManager.restore(savedGame)
        if (
          !game.roomCode ||
          this.allGames().some(
            (existing) =>
              existing.id !== gameId && existing.roomCode === game.roomCode
          )
        ) {
          game.roomCode = this.createUniqueRoomCode()
          updatedGameIds.push(gameId)
        }
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
      console.error(
        `Ignoring ${failures.length} invalid saved game(s):`,
        failures
      )
    }

    await Promise.all(updatedGameIds.map((gameId) => this.saveGame(gameId)))
  }

  private createUniqueRoomCode(): string {
    const existingCodes = new Set(
      this.allGames()
        .map((game) => game.roomCode)
        .filter(Boolean)
    )
    let roomCode: string
    do {
      roomCode = String(randomInt(100_000, 1_000_000))
    } while (existingCodes.has(roomCode))
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
        console.log('Deleting stale game:', gameId)
        await this.deleteGame(gameId)
        deletedGameIds.push(gameId)
      }
    }

    return deletedGameIds
  }

  // ------------------------------------------------------------------ formatting

  /**
   * Состояние для клиента.
   *
   * `tileHistory` сюда не входит: клиент его нигде не читает, а список растёт
   * с каждым ходом и раздувал бы каждое широковещательное сообщение. История
   * тайлов остаётся в сохранении, где она и нужна.
   */
  formatGameData(game: IGameBoard): GameData {
    return {
      placingPoint: game.placingPoint,
      tilePlacesStats: game.tilePlacesStats,
      tilesList: game.tilesList,
      dragonMove: game.dragonMove,
      princessChoice: game.princessChoice,
      princessFollowerPenalty: game.princessFollowerPenalty,
      dragonPosition: game.dragonPosition,
      currentTile: game.currentTile,
      players: game.players,
      currentPlayerIndex: game.currentPlayerIndex,
      availableFollowersPlaces: game.availableFollowersPlaces,
      availableFollowerTypes: this.collectAvailableFollowerTypes(game),
      abbotRecall: game.getAbbotRecallInfo(),
      gameIsEnded: game.gameIsEnded,
      finalScoringEnabled: game.finalScoringEnabled,
      rules: game.rules,
      moveCounter: game.moveCounter,
      id: game.id,
      roomCode: game.roomCode,
      isPlacingFollower: game.isPlacingFollower,
      scores: game.scores,
      gameIsStarted: game.gameIsStarted,
      gridSize: game.gridSize,
      completedObjects: game.completedObjects,
      temporaryObjects: game.temporaryObjects,
      lastPlacement: game.lastPlacement,
      availablePlacesTiles: game.availablePlacesTiles,
      playersFollowers: game.playersFollowers,
      actionsHistory: game.actionsHistory,
      currentPlayer: game.currentPlayer,
      placedFollowers: game.placedFollowers,
      winnerPlayerIds: game.winnerPlayerIds,
      lastUpdate: game.lastUpdate,
    }
  }

  /**
   * Допустимые типы фишек по каждому доступному месту. Ключ — id объекта:
   * место и объект однозначно совпадают, а сами места уже передаются отдельным
   * полем, поэтому клиенту достаточно посмотреть список по своему объекту.
   */
  private collectAvailableFollowerTypes(
    game: IGameBoard
  ): Record<string, FollowerType[]> {
    return Object.fromEntries(
      game.availableFollowersPlaces.map((place) => [
        place.temporaryObject.id,
        game.getAvailableFollowerTypes(place),
      ])
    )
  }

  formatGamesList(games: IGameBoard[] = this.allGames()): GameSummary[] {
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
