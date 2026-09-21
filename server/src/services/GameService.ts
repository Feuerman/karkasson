import { GameManager, type IGameBoard } from '../modules/GameManager'
import type { GameDatabase } from '../modules/Database'
import {
  playerColorForIndex,
  playerNameForIndex,
  type Player,
  type PlayerId,
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
  players: GameSummaryPlayer[]
  currentPlayer: PlayerId | null
  gameIsEnded: boolean
  moveCounter: number
  scores: Scores
  gameIsStarted: boolean
  lastUpdate: number
}

export interface GameData {
  tilePlacesStats: IGameBoard['tilePlacesStats']
  tilesList: IGameBoard['tilesList']
  currentTile: IGameBoard['currentTile']
  players: Player[]
  currentPlayerIndex: number
  availableFollowersPlaces: IGameBoard['availableFollowersPlaces']
  gameIsEnded: boolean
  moveCounter: number
  id: string | undefined
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

  constructor(private readonly db: GameDatabase) {}

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

  findPlayerGamesForSocket(socketId: string): IGameBoard[] {
    return this.allGames().filter((game) =>
      game.players.some((p) => p.socketId === socketId)
    )
  }

  deleteGame(gameId: string): void {
    delete this.games[gameId]
    void this.db.deleteGame(gameId)
  }

  saveGame(gameId: string): Promise<void> {
    const game = this.games[gameId]
    if (!game) return Promise.resolve()
    return this.db.saveGame(gameId, game)
  }

  createLobby(socketId: string): IGameBoard & { id: string } {
    const gameId = Math.random().toString(36).substring(7)
    const deviceId = this.getDeviceBySocketId(socketId)

    const players: Player[] = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      socketId: i === 0 ? socketId : null,
      deviceId: i === 0 ? (deviceId ?? null) : null,
      name: i === 0 ? playerNameForIndex(i) : '',
      color: playerColorForIndex(i),
      score: 0,
    }))

    const game = { id: gameId, players } as IGameBoard & { id: string }
    this.games[gameId] = game
    return game
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
    const newGame = new GameManager({ players: activePlayers })
    newGame.id = gameId
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

    savedGames.forEach((savedGame) => {
      if (!savedGame.id) return
      const game = new GameManager({ players: savedGame.players })
      Object.assign(game, savedGame)
      this.games[savedGame.id] = game
    })
  }

  /** Удаляет игры, которые не обновлялись дольше указанного времени */
  deleteStaleGames(timeoutMs: number): string[] {
    const deletedGameIds: string[] = []

    for (const [gameId, game] of Object.entries(this.games)) {
      if (!game.gameIsStarted || game.gameIsEnded) continue

      if (!game.lastUpdate) {
        game.lastUpdate = Date.now()
      }
      if (Date.now() - game.lastUpdate > timeoutMs) {
        console.log('Deleting stale game:', gameId)
        deletedGameIds.push(gameId)
        this.deleteGame(gameId)
      }
    }

    return deletedGameIds
  }

  // ------------------------------------------------------------------ formatting

  formatGameData(game: IGameBoard): GameData {
    return {
      tilePlacesStats: game.tilePlacesStats,
      tilesList: game.tilesList,
      currentTile: game.currentTile,
      players: game.players,
      currentPlayerIndex: game.currentPlayerIndex,
      availableFollowersPlaces: game.availableFollowersPlaces,
      gameIsEnded: game.gameIsEnded,
      moveCounter: game.moveCounter,
      id: game.id,
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
    return games.map((game) => ({
      id: game.id,
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
    }))
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
