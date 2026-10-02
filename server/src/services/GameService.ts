import { GameManager, type IGameBoard } from '../modules/GameManager'
import { deserializeGameState } from '../modules/gameSave'
import type { IGameDatabase } from '../modules/Database'
import { randomInt } from 'node:crypto'
import {
  playerColorForIndex,
  playerNameForIndex,
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
  dragonPosition?: IGameBoard['dragonPosition']
  currentTile: IGameBoard['currentTile']
  players: Player[]
  currentPlayerIndex: number
  availableFollowersPlaces: IGameBoard['availableFollowersPlaces']
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
  tileHistory: IGameBoard['tileHistory']
  playersFollowers: IGameBoard['playersFollowers']
  actionsHistory: IGameBoard['actionsHistory']
  currentPlayer: Player | null
  placedFollowers: IGameBoard['placedFollowers']
  lastUpdate: number
}

export interface JoinResult {
  error: string
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

  constructor(private readonly db: IGameDatabase) {}

  restoreGame(gameId: string, game: IGameBoard): void {
    this.games[gameId] = game
  }

  async flushGames(): Promise<void> {
    const gameIds = this.allGames()
      .map((game) => game.id)
      .filter((gameId): gameId is string => Boolean(gameId))
    await Promise.all(gameIds.map((gameId) => this.saveGame(gameId)))
    await Promise.all(this.pendingSaves.values())
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
    const pendingSave = this.pendingSaves.get(gameId)
    if (pendingSave) await pendingSave
    await this.db.deleteGame(gameId)
    delete this.games[gameId]
    delete this.lobbyOwners[gameId]
  }

  saveGame(gameId: string): Promise<void> {
    const game = this.games[gameId]
    if (!game) return Promise.resolve()
    const snapshot =
      typeof game.clone === 'function'
        ? game.clone()
        : (JSON.parse(JSON.stringify(game)) as IGameBoard)
    const previousSave = this.pendingSaves.get(gameId) ?? Promise.resolve()
    const save = previousSave.then(() => this.db.saveGame(gameId, snapshot))
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

  removePlayer(gameId: string, index: number, name: string | null) {
    const player = this.games[gameId]?.players[index]
    if (!player) return

    if (name) {
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
    if (!game) return { error: 'Game not found' }
    if (game.gameIsStarted) return { error: 'Игра уже началась' }
    if (game.players.some((player) => player.socketId === socketId)) {
      return { error: 'Вы уже присоединились к игре' }
    }
    if (game.players.every((p) => p.socketId)) {
      return { error: 'Все слоты заняты' }
    }

    const playerIndex = game.players.findIndex(
      (p) => !p.socketId && !p.deviceId
    )
    if (playerIndex === -1) {
      return { error: 'Все слоты заняты' }
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

  async loadSavedGames(): Promise<void> {
    const savedGames = await this.db.getAllGames()
    const updatedGameIds: string[] = []

    savedGames.forEach((rawSavedGame) => {
      try {
        const savedGame = deserializeGameState(rawSavedGame)
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
        game.temporaryObjects.gardens ??= []
        game.completedObjects.gardens ??= []
        game.rules ??= {
          finalScoringEnabled: game.finalScoringEnabled ?? false,
          expansions: {
            innsAndCathedrals: false,
            river: false,
            princessAndDragon: false,
          },
        }
        game.rules.expansions ??= {
          innsAndCathedrals: false,
          river: false,
          princessAndDragon: false,
        }
        game.rules.expansions.innsAndCathedrals ??= false
        game.rules.expansions.river ??= false
        game.rules.expansions.princessAndDragon ??= false
        for (const pool of Object.values(game.playersFollowers)) {
          pool.bigFollowers ??= 0
        }
        this.games[gameId] = game
      } catch (error) {
        console.error('Ignoring invalid saved game:', error)
      }
    })

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

  formatGameData(game: IGameBoard): GameData {
    return {
      placingPoint: game.placingPoint,
      tilePlacesStats: game.tilePlacesStats,
      tilesList: game.tilesList,
      dragonMove: game.dragonMove,
      princessChoice: game.princessChoice,
      dragonPosition: game.dragonPosition,
      currentTile: game.currentTile,
      players: game.players,
      currentPlayerIndex: game.currentPlayerIndex,
      availableFollowersPlaces: game.availableFollowersPlaces,
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
      tileHistory: game.tileHistory,
      playersFollowers: game.playersFollowers,
      actionsHistory: game.actionsHistory,
      currentPlayer: game.currentPlayer,
      placedFollowers: game.placedFollowers,
      lastUpdate: game.lastUpdate,
    }
  }

  formatGamesList(games: IGameBoard[] = this.allGames()): GameSummary[] {
    return games
      .map((game) => ({
        id: game.id,
        roomCode: game.roomCode ?? '',
        players: game.players.map((player) => ({
          id: player.id,
          name: player.name,
          color: player.color,
          socketId: player.socketId,
          deviceId: player.deviceId,
        })),
        currentPlayer: game.currentPlayer?.id ?? null,
        gameIsEnded: game.gameIsEnded,
        moveCounter: game.moveCounter,
        scores: game.scores,
        gameIsStarted: game.gameIsStarted,
        lastUpdate: game.lastUpdate,
        rules: game.rules,
      }))
      .sort((left, right) => {
        if (left.gameIsEnded !== right.gameIsEnded) {
          return left.gameIsEnded ? -1 : 1
        }
        if (left.gameIsEnded) return right.lastUpdate - left.lastUpdate
        return 0
      })
  }

  /** Список игр: сохранённые из базы, дополненные играми из памяти */
  async getGameSummaries(): Promise<GameSummary[]> {
    const memoryGames = this.allGames()
    const savedGames = await this.db.getAllGames()
    const mergedGames = [...memoryGames]

    savedGames.forEach((savedGame) => {
      if (!memoryGames.find((game) => game.id === savedGame.id)) {
        mergedGames.push(savedGame)
      }
    })

    return this.formatGamesList(mergedGames)
  }
}
