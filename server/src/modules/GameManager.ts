import { riverTiles } from '../data/riverTiles'
import { deepClone } from '../utils/common'
import { GameSimulatorModule } from './GameSimulatorModule'
import { getPrecisionCoordinates, isOppositePoint } from './gameGeometry'
import { rotateTileGroups, rotateTileSides } from './tileRotation'
import { GameObjectManager } from './GameObjectManager'
import { FollowerManager } from './FollowerManager'
import { GameTileManager } from './GameTileManager'
import {
  calcCityScore,
  calcGardenPoints,
  calcMonasteryPoints,
  calcRoadScore,
  distributeScore,
} from './scoring'
import {
  ActionTypes,
  ObjectTypes,
  ExpansionName,
  FollowerType as FollowerTypes,
  RotationDirection as RotationDirections,
  RotationTurns,
  SIDE_NAMES,
  SideName,
  TileRotation,
  TileId,
  TileSideType,
  type AvailableFollowerPlace,
  type AvailablePlace,
  type BaseObject,
  type CompletedObjects,
  type FollowerCount,
  type FollowerType,
  type GridTile,
  type GameRules,
  type DragonMoveState,
  type PrincessChoiceState,
  type DragonPosition,
  type ObjectFollower,
  type Player,
  type PlayerId,
  type PlacedFollower,
  type Point,
  type PointDirection,
  type RotationDirection,
  type ScoreForObject,
  type Scores,
  type TemporaryObjects,
  type Tile,
  type TilePlacesStats,
} from './types'

export type { AvailableFollowerPlace, RotationDirection } from './types'

export interface PlaceTileActionData {
  tile: Tile
  rowIndex: number
  tileIndex: number
}

export interface PlaceFollowerActionData extends AvailableFollowerPlace {
  followerType?: FollowerType
}

export interface AddingScoresActionData {
  objectType: ObjectTypes
  objectData: BaseObject
  score: ScoreForObject
}

export interface BackFollowerActionData {
  followers: ObjectFollower[]
}

export type GameAction =
  | {
      actionType: ActionTypes.PLACE_TILE
      actionData: PlaceTileActionData
      initiator?: Player | null
    }
  | {
      actionType: ActionTypes.PLACE_FOLLOWER
      actionData: PlaceFollowerActionData
      initiator?: Player | null
    }
  | {
      actionType: ActionTypes.ADDING_SCORES
      actionData: AddingScoresActionData
      initiator?: Player | null
    }
  | {
      actionType: ActionTypes.BACK_FOLLOWER
      actionData: BackFollowerActionData
      initiator?: Player | null
    }

export interface IGameBoard {
  id?: string
  roomCode?: string
  gridSize: number[]
  gameIsStarted: boolean
  gameIsEnded: boolean
  finalScoringEnabled: boolean
  rules: GameRules
  tilesList: Tile[]
  currentTile: GridTile | null
  players: Player[]
  currentPlayer: Player | null
  currentPlayerIndex: number
  playersFollowers: Record<PlayerId, FollowerCount>
  temporaryObjects: TemporaryObjects
  completedObjects: CompletedObjects
  scores: Scores
  availableFollowersPlaces: AvailableFollowerPlace[]
  isPlacingFollower: boolean
  availablePlacesTiles: AvailablePlace[]
  lastPlacement: { rowIndex?: number; tileIndex?: number }
  tileHistory: Tile[]
  actionsHistory: GameAction[]
  moveCounter: number
  lastUpdate: number
  placedFollowers: PlacedFollower[]
  placingPoint?: { rowIndex: number; tileIndex: number }
  dragonMove?: DragonMoveState
  princessChoice?: PrincessChoiceState
  dragonPosition?: DragonPosition
  moveDragon(rowIndex: number, tileIndex: number): boolean
  choosePrincessFollower(cityId: string, point: Point): boolean
  tilePlacesStats: TilePlacesStats
  startGame(): void
  placeFollower(
    availablePlace: AvailableFollowerPlace,
    followerType?: FollowerType
  ): void
  skipFollower(): void
  recallAbbot(): boolean
  placeTile(tile: Tile, rowIndex: number, tileIndex: number): boolean
  autoPlaceTile(): Promise<void>
  calcScoreForCity(city: BaseObject, isCompleted?: boolean): ScoreForObject
  calcScoreForRoad(road: BaseObject, isCompleted?: boolean): ScoreForObject
  getNextPlayer(currentPlayerId: PlayerId | undefined): Player
  clone(): IGameBoard
  cloneForSimulation(): IGameBoard
  copyStateFrom(source: IGameBoard): void
  simulatePlaceTile(tile: Tile, rowIndex: number, tileIndex: number): boolean
  simulatePlaceFollower(
    place: AvailableFollowerPlace,
    followerType?: FollowerType
  ): boolean
  getTileFeatureGroups(
    tile: Tile,
    feature: typeof TileSideType.City | typeof TileSideType.Road
  ): SideName[][]
  rotateTileGroups(
    groups: SideName[][] | undefined,
    turns: number
  ): SideName[][] | undefined
}

export class GameManager implements IGameBoard {
  id?: string
  roomCode?: string
  gridSize = [30, 30]
  gameIsStarted: boolean
  gameIsEnded: boolean
  finalScoringEnabled: boolean
  rules: GameRules
  tilesList: Tile[]
  currentTile: GridTile | null
  players: Player[]
  currentPlayer: Player | null
  currentPlayerIndex: number
  playersFollowers: Record<PlayerId, FollowerCount>
  temporaryObjects: TemporaryObjects
  completedObjects: CompletedObjects
  scores: Scores
  availableFollowersPlaces: AvailableFollowerPlace[]
  isPlacingFollower: boolean
  placedFollowers: PlacedFollower[]
  tilePlacesStats: TilePlacesStats = {}
  lastPlacement: { rowIndex?: number; tileIndex?: number }
  availablePlacesTiles: AvailablePlace[]
  tileHistory: Tile[]
  moveCounter: number
  actionsHistory: GameAction[]
  lastUpdate = 0
  placingPoint?: { rowIndex: number; tileIndex: number }
  dragonMove?: DragonMoveState
  princessChoice?: PrincessChoiceState
  dragonPosition?: DragonPosition
  pendingDragonMovement = false
  private dragonResumePlayerIndex = 0
  private isPlacingStartTile = false

  constructor(
    params: {
      players?: Player[]
      startImmediately?: boolean
      finalScoringEnabled?: boolean
      innsAndCathedralsEnabled?: boolean
      riverEnabled?: boolean
      princessAndDragonEnabled?: boolean
    } = {}
  ) {
    const players = params.players ?? []

    this.gameIsStarted = false
    this.gameIsEnded = false
    this.finalScoringEnabled = params.finalScoringEnabled ?? false
    this.rules = {
      finalScoringEnabled: params.finalScoringEnabled ?? false,
      expansions: {
        innsAndCathedrals: params.innsAndCathedralsEnabled ?? false,
        river: params.riverEnabled ?? false,
        princessAndDragon: params.princessAndDragonEnabled ?? false,
      },
    }
    this.tilesList = []
    this.currentTile = null
    this.players = []
    this.currentPlayer = null
    this.currentPlayerIndex = 0
    this.availableFollowersPlaces = []
    this.isPlacingFollower = false
    this.temporaryObjects = {
      cities: [],
      roads: [],
      monasteries: [],
      gardens: [],
    }
    this.completedObjects = {
      cities: [],
      roads: [],
      monasteries: [],
      gardens: [],
    }
    this.scores = {}
    this.playersFollowers = {}
    this.placedFollowers = []
    this.moveCounter = 1
    this.lastPlacement = { rowIndex: undefined, tileIndex: undefined }
    this.availablePlacesTiles = []
    this.tileHistory = []
    this.actionsHistory = []
    this.princessChoice = undefined

    this.initTilesList()
    this.initPlayers(players)

    if (params.startImmediately !== false) this.startGame()
  }

  private get objectManager(): GameObjectManager {
    return new GameObjectManager(this)
  }

  private get followerManager(): FollowerManager {
    return new FollowerManager(this)
  }

  private get tileManager(): GameTileManager {
    return new GameTileManager(
      this,
      () => this.finishGame(),
      () => this.isPlacingStartTile
    )
  }

  initTilesList() {
    this.tileManager.initializeDeck()
  }

  initPlayers(players: Player[]) {
    players.forEach((player) => {
      this.players.push(player)
      this.scores[player.id] = 0
    })

    this.playersFollowers = players.reduce<Record<PlayerId, FollowerCount>>(
      (acc, player) => {
        acc[player.id] = {
          ordinaryFollowers: 7,
          ...(this.rules.expansions.innsAndCathedrals
            ? { bigFollowers: 1 }
            : {}),
          monks: 1,
        }
        return acc
      },
      {}
    )
  }

  startGame() {
    this.gameIsStarted = true
    if (this.rules.expansions.river) {
      this.currentPlayer = this.players[0] ?? null
      this.currentPlayerIndex = 0
    }
    this.isPlacingStartTile = true
    this.placeStartTile()
    this.isPlacingStartTile = false
    if (this.rules.expansions.river) this.getRandomTileFromList()
    if (!this.rules.expansions.river) {
      this.currentPlayer = this.players[0] ?? null
      this.currentPlayerIndex = 0
    }
  }

  placeStartTile() {
    const centerCoordinates = {
      rowIndex: Math.floor(this.gridSize[1] / 2),
      tileIndex: Math.floor(this.gridSize[0] / 2),
    }

    const startTileId = this.rules.expansions.river ? TileId.RIVER_A : TileId.D
    const startDefinition = this.rules.expansions.river
      ? riverTiles.find(({ id }) => id === startTileId)
      : this.tilesList.find(({ id }) => id === startTileId)
    if (!startDefinition) throw new Error('Game has no starting tile')
    const startTile: Tile = { ...startDefinition, rotation: 0 }
    const startTileIndex = this.tilesList.findIndex(
      (tile) => tile.id === startTileId
    )
    if (startTileIndex >= 0) this.tilesList.splice(startTileIndex, 1)

    this.tileHistory.push(deepClone(startTile))
    const wasPlacingStartTile = this.isPlacingStartTile
    this.isPlacingStartTile = this.rules.expansions.river
    const isPlaced = this.placeTile(
      startTile,
      centerCoordinates.rowIndex,
      centerCoordinates.tileIndex
    )
    this.isPlacingStartTile = wasPlacingStartTile
    if (!isPlaced) throw new Error('Unable to place starting tile')
  }

  endTurn() {
    const currentPlayer = this.currentPlayer

    if (
      this.players.findIndex((player) => player.id === currentPlayer?.id) ===
      this.players.length - 1
    ) {
      this.moveCounter = this.moveCounter + 1
    }
    this.isPlacingFollower = false
    this.princessChoice = undefined

    const nextPlayer = this.getNextPlayer(currentPlayer?.id)

    this.currentPlayer = nextPlayer
    this.currentPlayerIndex = this.players.findIndex(
      (player) => player.id === nextPlayer.id
    )

    if (this.pendingDragonMovement) {
      this.pendingDragonMovement = false
      this.startDragonMove()
    } else if (!this.dragonMove) {
      this.getRandomTileFromList()
    }
  }

  getNextPlayer(currentPlayerId: PlayerId | undefined): Player {
    const currentPlayerIndex = this.players.findIndex(
      (player) => player.id === currentPlayerId
    )

    if (currentPlayerIndex === -1) {
      return this.players[0]
    }

    return this.players[
      currentPlayerIndex === this.players.length - 1
        ? 0
        : currentPlayerIndex + 1
    ]
  }

  checkAvailableFollowers() {
    this.followerManager.checkAvailableFollowers()
  }

  findAvailableFollowersPlaces(tile: GridTile): AvailableFollowerPlace[] {
    return this.followerManager.findAvailableFollowersPlaces(tile)
  }

  placeTile(tile: Tile, rowIndex: number, tileIndex: number): boolean {
    if (this.gameIsEnded) return false
    const tileDefinition = this.tileManager.findTileDefinition(tile.id)
    const authoritativeTile: Tile = tileDefinition
      ? { ...tileDefinition, rotation: 0 }
      : { ...tile }
    if (
      authoritativeTile.expansion === ExpansionName.InnsAndCathedrals &&
      !this.rules.expansions.innsAndCathedrals
    ) {
      return false
    }
    if (
      authoritativeTile.expansion === ExpansionName.River &&
      !this.rules.expansions.river
    ) {
      return false
    }
    if (
      this.rules.expansions.river &&
      !this.isPlacingStartTile &&
      !authoritativeTile.riverGroups?.length &&
      !Object.values(this.tilePlacesStats).some((row) =>
        Object.values(row).some(
          (placedTile) => placedTile.id === TileId.RIVER_L
        )
      )
    ) {
      return false
    }
    let resolvedTile: Tile
    const turnCount = TileRotation.FullTurn / TileRotation.QuarterTurn
    const normalizedTurns =
      ((Math.round(tile.rotation / TileRotation.QuarterTurn) % turnCount) +
        turnCount) %
      turnCount
    if (tileDefinition) {
      resolvedTile = { ...authoritativeTile, rotation: 0 }
      for (let turn = 0; turn < normalizedTurns; turn++) {
        resolvedTile = this.rotateTile(resolvedTile)
      }
    } else {
      resolvedTile = { ...authoritativeTile }
    }
    resolvedTile.hasGarden = tile.hasGarden ?? resolvedTile.hasGarden
    if (tileDefinition) {
      resolvedTile.sides = rotateTileSides(
        authoritativeTile.sides,
        normalizedTurns
      )
      resolvedTile.roadGroups = rotateTileGroups(
        authoritativeTile.roadGroups,
        normalizedTurns
      )
      resolvedTile.cityGroups = rotateTileGroups(
        authoritativeTile.cityGroups,
        normalizedTurns
      )
      resolvedTile.cityShieldGroups = rotateTileGroups(
        authoritativeTile.cityShieldGroups,
        normalizedTurns
      )
      resolvedTile.riverGroups = rotateTileGroups(
        authoritativeTile.riverGroups,
        normalizedTurns
      )
    }
    tile = resolvedTile

    const isCorrectPosition = this.tileManager.isValidTilePlacement(
      tile,
      rowIndex,
      tileIndex
    )

    if (!isCorrectPosition) {
      return false
    }

    if (this.currentTile && !this.isPlacingStartTile) {
      this.currentTile.x = tileIndex
      this.currentTile.y = rowIndex
    }

    if (!this.tilePlacesStats[rowIndex]) {
      this.tilePlacesStats[rowIndex] = {}
    }
    this.tilePlacesStats[rowIndex][tileIndex] = {
      ...tile,
      rowIndex,
      tileIndex,
      x: tileIndex,
      y: rowIndex,
    }
    this.lastPlacement = { tileIndex, rowIndex }

    this.actionsHistory.push({
      actionType: ActionTypes.PLACE_TILE,
      actionData: { tile, rowIndex, tileIndex },
      initiator: this.currentPlayer,
    })

    this.setAvailablePlacesTiles({ rowIndex, tileIndex })

    this.checkGridAfterPlacingTile(rowIndex, tileIndex)

    if (!this.isPlacingStartTile && this.rules.expansions.princessAndDragon) {
      this.applyPrincessAndDragonTile(tile, rowIndex, tileIndex)
    }

    if (this.princessChoice && !this.currentPlayer?.socketId) {
      const follower = this.princessChoice.followers[0]
      if (follower) {
        this.choosePrincessFollower(follower.cityId, follower.point)
      }
    }

    if (
      !this.isPlacingStartTile &&
      tile.hasVolcano &&
      this.rules.expansions.princessAndDragon
    ) {
      this.dragonPosition = { rowIndex, tileIndex }
      this.dragonMove = undefined
      this.princessChoice = undefined
      this.currentTile = null
      this.availableFollowersPlaces = []
      this.isPlacingFollower = false
      this.endTurn()
      return true
    }

    if (!this.isPlacingStartTile && !this.princessChoice) {
      this.checkAvailableFollowers()
    }

    if (!this.currentPlayer && !this.isPlacingStartTile) {
      this.endTurn()
    }

    return true
  }

  setAvailablePlacesTiles({
    rowIndex,
    tileIndex,
  }: {
    rowIndex: number
    tileIndex: number
  }) {
    const oppositeTilesCoords = [
      { rowIndex: rowIndex - 1, tileIndex },
      { rowIndex, tileIndex: tileIndex + 1 },
      { rowIndex: rowIndex + 1, tileIndex },
      { rowIndex, tileIndex: tileIndex - 1 },
    ]

    oppositeTilesCoords.forEach((tile) => {
      const alreadyOccupied = Boolean(
        this.tilePlacesStats[tile.rowIndex]?.[tile.tileIndex]
      )
      const alreadyPlanned = Boolean(
        this.availablePlacesTiles.find(
          (place) =>
            place.rowIndex === tile.rowIndex &&
            place.tileIndex === tile.tileIndex
        )
      )
      if (alreadyOccupied || alreadyPlanned) return

      const adjacentTileMap: Record<
        SideName,
        { rowIndex: number; tileIndex: number; side: SideName }
      > = {
        [SideName.North]: {
          rowIndex: tile.rowIndex - 1,
          tileIndex: tile.tileIndex,
          side: SideName.South,
        },
        [SideName.East]: {
          rowIndex: tile.rowIndex,
          tileIndex: tile.tileIndex + 1,
          side: SideName.West,
        },
        [SideName.South]: {
          rowIndex: tile.rowIndex + 1,
          tileIndex: tile.tileIndex,
          side: SideName.North,
        },
        [SideName.West]: {
          rowIndex: tile.rowIndex,
          tileIndex: tile.tileIndex - 1,
          side: SideName.East,
        },
      }

      const objects = (Object.keys(adjacentTileMap) as SideName[]).map(
        (side) => {
          const adjacent = adjacentTileMap[side]
          const adjacentTile =
            this.tilePlacesStats[adjacent.rowIndex]?.[adjacent.tileIndex]

          if (!adjacentTile) return null
          return (
            this.findObjectByPoint(
              this.temporaryObjects,
              adjacent.tileIndex,
              adjacent.rowIndex,
              adjacent.side
            ) ?? null
          )
        }
      )

      this.availablePlacesTiles.push({ ...tile, objects })
    })

    this.availablePlacesTiles = this.availablePlacesTiles.filter((place) => {
      return place.rowIndex !== rowIndex || place.tileIndex !== tileIndex
    })
  }

  goPlaceFollower() {
    this.followerManager.goPlaceFollower()
  }

  placeFollower(
    availablePlace: AvailableFollowerPlace,
    followerType: FollowerType = FollowerTypes.Follower
  ) {
    this.followerManager.placeFollower(availablePlace, followerType)
  }

  skipFollower() {
    this.followerManager.skipFollower()
  }

  moveDragon(rowIndex: number, tileIndex: number): boolean {
    const move = this.dragonMove
    if (!move || !Number.isInteger(rowIndex) || !Number.isInteger(tileIndex)) {
      return false
    }
    if (this.currentPlayerIndex !== move.nextPlayerIndex) return false
    const currentPosition = this.findDragonPosition()
    if (!currentPosition) return false
    const distance =
      Math.abs(currentPosition.rowIndex - rowIndex) +
      Math.abs(currentPosition.tileIndex - tileIndex)
    if (distance !== 1) return false
    if (
      move.visited.some(
        (position) =>
          position.rowIndex === rowIndex && position.tileIndex === tileIndex
      )
    )
      return false
    const destination = this.tilePlacesStats[rowIndex]?.[tileIndex]
    if (!destination) return false
    if (this.currentPlayerIndex !== this.dragonMove?.nextPlayerIndex)
      return false
    this.dragonPosition = { rowIndex, tileIndex }

    const occupants = this.placedFollowers.filter(
      (follower) =>
        follower.point.x === tileIndex && follower.point.y === rowIndex
    )
    for (const follower of occupants) this.removeFollowerFromBoard(follower)

    move.visited.push({ rowIndex, tileIndex })
    move.remainingSteps -= 1
    move.nextPlayerIndex = this.players.length
      ? (move.nextPlayerIndex + 1) % this.players.length
      : 0
    this.currentPlayerIndex = move.nextPlayerIndex
    this.currentPlayer = this.players[this.currentPlayerIndex] ?? null
    if (move.remainingSteps <= 0) {
      this.finishDragonMove()
    } else {
      this.advanceDragonMove()
    }
    return true
  }

  choosePrincessFollower(cityId: string, point: Point): boolean {
    const choice = this.princessChoice
    if (!choice) return false
    const city = this.temporaryObjects.cities.find(({ id }) => id === cityId)
    if (!city) return false
    const selectedFollower = choice.followers.find(
      (candidate) =>
        candidate.cityId === cityId &&
        candidate.point.x === point.x &&
        candidate.point.y === point.y &&
        candidate.point.direction === point.direction
    )
    if (!selectedFollower) return false
    const follower = this.placedFollowers.find(
      (placed) =>
        placed.objectId === city.id &&
        placed.point.x === selectedFollower.point.x &&
        placed.point.y === selectedFollower.point.y &&
        placed.point.direction === selectedFollower.point.direction
    )
    if (!follower) return false
    this.removeFollowerFromBoard(follower)
    this.princessChoice = undefined
    if (this.currentTile) this.checkAvailableFollowers()
    return true
  }

  private applyPrincessAndDragonTile(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ) {
    if (!this.rules.expansions.princessAndDragon) return

    if (tile.hasPrincess) {
      const adjacentCities = this.findCitiesOnPrincessTile(rowIndex, tileIndex)
      if (adjacentCities.length) {
        this.princessChoice = {
          followers: adjacentCities.flatMap((city) =>
            city.followers.map((follower) => ({
              cityId: city.id,
              point: follower.point,
            }))
          ),
        }
      }
    }

    if (tile.hasDragon && this.dragonPosition) this.pendingDragonMovement = true
  }

  private findCitiesOnPrincessTile(rowIndex: number, tileIndex: number) {
    return this.temporaryObjects.cities.filter(
      (city) =>
        city.followers.length > 0 &&
        city.points.some(
          (point) => point.x === tileIndex && point.y === rowIndex
        )
    )
  }

  private findDragonPosition(): DragonPosition | undefined {
    if (this.dragonPosition) return this.dragonPosition
    for (const [row, tiles] of Object.entries(this.tilePlacesStats)) {
      for (const [column, tile] of Object.entries(tiles)) {
        if (tile.hasVolcano) {
          this.dragonPosition = {
            rowIndex: Number(row),
            tileIndex: Number(column),
          }
          return this.dragonPosition
        }
      }
    }
    return undefined
  }

  private startDragonMove() {
    const position = this.findDragonPosition()
    if (!position) {
      this.getRandomTileFromList()
      return
    }
    // endTurn() advances to the player after the tile placer. The placer moves
    // the dragon first; once movement ends, normal turns resume at that already
    // selected next player.
    this.dragonResumePlayerIndex = this.currentPlayerIndex
    this.dragonMove = {
      remainingSteps: 6,
      nextPlayerIndex: this.players.length
        ? (this.currentPlayerIndex - 1 + this.players.length) %
          this.players.length
        : 0,
      resumePlayerIndex: this.dragonResumePlayerIndex,
      visited: [{ ...position }],
    }
    this.advanceDragonMove()
  }

  private advanceDragonMove() {
    const move = this.dragonMove
    if (!move) return
    const currentPosition = move.visited[move.visited.length - 1]
    const validDestinations = currentPosition
      ? this.getDragonDestinations(currentPosition)
      : []
    if (!validDestinations.length) {
      this.finishDragonMove()
      return
    }
    this.currentPlayerIndex = move.nextPlayerIndex
    this.currentPlayer = this.players[this.currentPlayerIndex] ?? null
    if (this.currentPlayer && !this.currentPlayer.socketId) {
      const destination = validDestinations[0]
      if (destination)
        this.moveDragon(destination.rowIndex, destination.tileIndex)
    }
  }

  private getDragonDestinations(position: DragonPosition): DragonPosition[] {
    const offsets = [
      { rowIndex: -1, tileIndex: 0 },
      { rowIndex: 0, tileIndex: 1 },
      { rowIndex: 1, tileIndex: 0 },
      { rowIndex: 0, tileIndex: -1 },
    ]
    const move = this.dragonMove
    if (!move) return []
    return offsets
      .map((offset) => ({
        rowIndex: position.rowIndex + offset.rowIndex,
        tileIndex: position.tileIndex + offset.tileIndex,
      }))
      .filter((destination) => {
        const tile =
          this.tilePlacesStats[destination.rowIndex]?.[destination.tileIndex]
        return (
          Boolean(tile) &&
          !move.visited.some(
            (visited) =>
              visited.rowIndex === destination.rowIndex &&
              visited.tileIndex === destination.tileIndex
          )
        )
      })
  }

  private finishDragonMove() {
    const move = this.dragonMove
    this.dragonMove = undefined
    this.isPlacingFollower = false
    this.availableFollowersPlaces = []
    if (move && this.players.length) {
      this.currentPlayerIndex = move.resumePlayerIndex
      this.currentPlayer = this.players[move.resumePlayerIndex] ?? null
    }
    this.getRandomTileFromList()
  }

  private removeFollowerFromBoard(follower: PlacedFollower | undefined) {
    if (!follower) return
    const collections = [
      this.temporaryObjects.cities,
      this.temporaryObjects.roads,
      this.temporaryObjects.monasteries,
      this.temporaryObjects.gardens,
      this.completedObjects.cities,
      this.completedObjects.roads,
      this.completedObjects.monasteries,
      this.completedObjects.gardens,
    ]
    for (const collection of collections) {
      const object = collection.find(({ id }) => id === follower.objectId)
      if (!object) continue
      object.followers = object.followers.filter(
        (placed) =>
          !(
            placed.playerId === follower.playerId &&
            placed.point.x === follower.point.x &&
            placed.point.y === follower.point.y &&
            placed.point.direction === follower.point.direction
          )
      )
    }
    const pool = this.playersFollowers[follower.playerId]
    if (pool) {
      if (follower.isAbbot) pool.monks += 1
      else if (follower.isBigFollower)
        pool.bigFollowers = (pool.bigFollowers ?? 0) + 1
      else pool.ordinaryFollowers += 1
    }
    this.placedFollowers = this.placedFollowers.filter(
      (placed) => placed !== follower
    )
    this.actionsHistory.push({
      actionType: ActionTypes.BACK_FOLLOWER,
      actionData: {
        followers: [
          {
            playerId: follower.playerId,
            objectId: follower.objectId,
            point: follower.point,
            isAbbot: follower.isAbbot,
            isBigFollower: follower.isBigFollower,
          },
        ],
      },
    })
  }

  /**
   * Отзыв аббата в ход владельца: аббат снимается с монастыря или сада
   * (завершённого или нет) и начисляются очки за «незавершённый» объект —
   * 1 очко за сам тайл и по 1 очку за каждую занятую клетку в окрестности 3×3.
   * Ход не расходуется: игрок после отзыва продолжает свой ход.
   */
  recallAbbot(): boolean {
    return this.followerManager.recallAbbot()
  }

  findObjectByPoint(
    objects: TemporaryObjects,
    x: number,
    y: number,
    direction?: PointDirection
  ): BaseObject | undefined {
    return [
      ...objects.cities,
      ...objects.roads,
      ...objects.monasteries,
      ...objects.gardens,
    ].find((object) => {
      return object.points.some((point) => {
        return (
          point.x === x &&
          point.y === y &&
          (!direction || point.direction === direction)
        )
      })
    })
  }

  async autoPlaceTile(): Promise<void> {
    if (this.gameIsEnded) return

    if (this.dragonMove) {
      const currentPosition = this.dragonMove.visited.at(-1)
      const destination = currentPosition
        ? this.getDragonDestinations(currentPosition)[0]
        : undefined
      if (destination)
        this.moveDragon(destination.rowIndex, destination.tileIndex)
      return
    }

    // Ensure we have a current tile
    if (!this.currentTile) {
      this.getRandomTileFromList()
      if (!this.currentTile) return
    }

    const simulator = new GameSimulatorModule(this)
    const result = simulator.findBestMove(this.currentTile)

    if (result.moves.length) {
      const move = result.moves[0]
      const currentTile = this.currentTile
      if (!currentTile) return
      let rotatedTile: Tile = { ...currentTile, rotation: 0 }
      for (
        let turn = 0;
        turn < move.rotation / TileRotation.QuarterTurn;
        turn++
      ) {
        rotatedTile = this.rotateTile(rotatedTile)
      }
      const tilePlaced = this.placeTile(
        rotatedTile,
        move.rowIndex,
        move.tileIndex
      )
      if (!tilePlaced) return

      if (this.princessChoice) {
        const follower = this.princessChoice.followers[0]
        if (follower) {
          this.choosePrincessFollower(follower.cityId, follower.point)
        }
        return
      }

      if (move.followerPlace && move.followerType) {
        const actualPlace = this.availableFollowersPlaces.find(
          (place) =>
            place.point.x === move.followerPlace?.point.x &&
            place.point.y === move.followerPlace?.point.y &&
            place.point.direction === move.followerPlace?.point.direction
        )
        if (actualPlace) this.placeFollower(actualPlace, move.followerType)
      } else if (this.availableFollowersPlaces.length) {
        this.skipFollower()
      }
    } else {
      // If no valid moves found, get a new tile and try again
      this.getRandomTileFromList()
      if (this.currentTile) {
        await this.autoPlaceTile()
      }
    }
  }

  getRandomTileFromList() {
    if (this.gameIsEnded) return
    this.tileManager.drawNextTile()
  }

  private finishGame() {
    this.gameIsEnded = true
    this.currentTile = null
    this.isPlacingFollower = false
    this.availableFollowersPlaces = []
    this.availablePlacesTiles = []
    this.currentPlayer = null
    this.tilesList = []
    if (this.finalScoringEnabled) this.finalizeScoring()
  }

  private finalizeScoring() {
    const completedMonasteries = [...this.completedObjects.monasteries]
    const completedGardens = [...this.completedObjects.gardens]
    const unfinishedRoads = this.temporaryObjects.roads
    const unfinishedCities = this.temporaryObjects.cities
    const unfinishedMonasteries = this.temporaryObjects.monasteries
    const unfinishedGardens = this.temporaryObjects.gardens

    this.temporaryObjects.roads = []
    this.temporaryObjects.cities = []
    this.temporaryObjects.monasteries = []
    this.temporaryObjects.gardens = []

    for (const road of unfinishedRoads) {
      const score = this.calcScoreForRoad(road, false)
      this.recordFinalObjectScore(road, score, ObjectTypes.ROAD)
      this.completedObjects.roads.push({ ...deepClone(road), score })
    }

    for (const city of unfinishedCities) {
      const score = this.calcScoreForCity(city, false)
      this.recordFinalObjectScore(city, score, ObjectTypes.CITY)
      this.completedObjects.cities.push({ ...deepClone(city), score })
    }

    for (const monastery of unfinishedMonasteries) {
      const points = calcMonasteryPoints(this.tilePlacesStats, monastery)
      const score = distributeScore(points, monastery.followers, this.scores)
      this.recordFinalObjectScore(monastery, score, ObjectTypes.MONASTERY)
      this.completedObjects.monasteries.push({
        ...deepClone(monastery),
        score,
      })
    }

    for (const garden of unfinishedGardens) {
      const points = calcGardenPoints(this.tilePlacesStats, garden)
      const score = distributeScore(points, garden.followers, this.scores)
      this.recordFinalObjectScore(garden, score, ObjectTypes.GARDEN)
      this.completedObjects.gardens.push({ ...deepClone(garden), score })
    }

    this.scoreRemainingAbbots(completedMonasteries, false)
    this.scoreRemainingAbbots(completedGardens, true)
  }

  private scoreRemainingAbbots(objects: BaseObject[], isGarden: boolean) {
    for (const object of objects) {
      const abbots = object.followers.filter((follower) => follower.isAbbot)
      if (!abbots.length) continue

      const points = isGarden
        ? calcGardenPoints(this.tilePlacesStats, object)
        : calcMonasteryPoints(this.tilePlacesStats, object)
      const score = distributeScore(points, abbots, this.scores)
      object.score = score
      this.recordFinalObjectScore(
        { ...object, followers: abbots },
        score,
        isGarden ? ObjectTypes.GARDEN : ObjectTypes.MONASTERY
      )
    }
  }

  private recordFinalObjectScore(
    object: BaseObject,
    score: ScoreForObject,
    objectType: ObjectTypes
  ) {
    if (!object.followers.length) return
    this.actionsHistory.push({
      actionType: ActionTypes.ADDING_SCORES,
      actionData: {
        objectType,
        objectData: deepClone(object),
        score,
      },
    })
  }

  checkAvailablePlacesForTile(tile: Tile): boolean {
    return this.tileManager.checkAvailablePlacesForTile(tile)
  }

  updateTileHistory(tile: Tile) {
    this.tileHistory.push(deepClone(tile))
  }

  checkGridAfterPlacingTile(rowIndex: number, tileIndex: number) {
    this.objectManager.checkGridAfterPlacingTile(rowIndex, tileIndex)
  }

  checkMonasteries(tile: GridTile) {
    this.objectManager.checkMonasteries(tile)
  }

  checkCompletedMonasteries() {
    this.objectManager.checkCompletedMonasteries()
  }

  calcScoreForMonasteries(monasteries: BaseObject[]) {
    this.objectManager.calcScoreForMonasteries(monasteries)
  }

  checkGardens(tile: GridTile) {
    this.objectManager.checkGardens(tile)
  }

  checkCompletedGardens() {
    this.objectManager.checkCompletedGardens()
  }

  calcScoreForGardens(gardens: BaseObject[]) {
    this.objectManager.calcScoreForGardens(gardens)
  }

  checkRoads(roadsPoints: Point[], connectedGroups?: Point[][]) {
    this.objectManager.checkRoads(roadsPoints, connectedGroups)
  }

  mergeRoads(roadsIds: string[], roadsPoints: Point[]) {
    this.objectManager.mergeRoads(roadsIds, roadsPoints)
  }

  checkCompleteRoad(road: BaseObject) {
    this.objectManager.checkCompleteRoad(road)
  }

  calcScoreForRoad(road: BaseObject, isCompleted = true): ScoreForObject {
    return calcRoadScore(
      this.tilePlacesStats,
      road,
      this.scores,
      isCompleted,
      this.rules.expansions.innsAndCathedrals
    )
  }

  checkCities(citiesPoints: Point[], connectedGroups?: Point[][]) {
    this.objectManager.checkCities(citiesPoints, connectedGroups)
  }

  mergeCities(citiesIds: string[], citiesPoints: Point[]) {
    this.objectManager.mergeCities(citiesIds, citiesPoints)
  }

  checkCompleteCity(city: BaseObject) {
    this.objectManager.checkCompleteCity(city)
  }

  calcScoreForCity(city: BaseObject, isCompleted = true): ScoreForObject {
    return calcCityScore(
      this.tilePlacesStats,
      city,
      this.scores,
      isCompleted,
      this.rules.expansions.innsAndCathedrals,
      this.rules.expansions.innsAndCathedrals
    )
  }

  private isFollowerPlacementAvailable(
    place: AvailableFollowerPlace,
    object: BaseObject
  ): boolean {
    return this.followerManager.isFollowerPlacementAvailable(place, object)
  }

  isCorrectTilePosition(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): boolean {
    return this.tileManager.isCorrectTilePosition(tile, rowIndex, tileIndex)
  }

  getTileFeatureGroups(
    tile: Tile,
    feature: typeof TileSideType.City | typeof TileSideType.Road
  ): SideName[][] {
    const featureSides = SIDE_NAMES.filter(
      (side) => tile.sides[side] === feature
    )

    const definition = this.tileManager.findTileDefinition(tile.id)
    const tileGroups =
      feature === TileSideType.City ? tile.cityGroups : tile.roadGroups
    const definitionGroups =
      feature === TileSideType.City
        ? definition?.cityGroups
        : definition?.roadGroups
    const groups =
      tileGroups ??
      this.rotateTileGroups(
        definitionGroups,
        Math.round(tile.rotation / TileRotation.QuarterTurn)
      ) ??
      []

    // Т-образные перекрёстки и четырёхсторонние перекрёстки делят дорожные
    // ответвления независимо друг от друга. Но если каталог описывает на
    // четырёхстороннем тайле несколько собственных соединений (например,
    // IAC-E), эти явно заданные группы определяют топологию тайла.
    const connectedRoadGroups = groups.filter((group) => group.length > 1)
    if (
      feature === TileSideType.Road &&
      featureSides.length >= 3 &&
      connectedRoadGroups.length < 2
    ) {
      return featureSides.map((side) => [side])
    }

    // Каталожные группы описывают соединения, а стороны без группы остаются
    // отдельными сегментами. Нормализация не допускает дублирования стороны
    // или включения в группу стороны другого типа.
    const assigned = new Set<SideName>()
    const normalizedGroups = groups
      .map((group) =>
        group.filter((side) => {
          if (!featureSides.includes(side) || assigned.has(side)) {
            return false
          }
          assigned.add(side)
          return true
        })
      )
      .filter((group) => group.length > 0)

    for (const side of featureSides) {
      if (!assigned.has(side)) normalizedGroups.push([side])
    }

    return normalizedGroups
  }

  isOppositePoint(point: Point, oppositePoint: Point): boolean {
    return isOppositePoint(point, oppositePoint)
  }

  getPrecisionCoordinates(point: Point): { x: number; y: number } {
    return getPrecisionCoordinates(point)
  }

  rotateTile(
    tile: Tile,
    direction: RotationDirection = RotationDirections.Clockwise
  ): Tile {
    const processedTile = { ...tile }
    const quarterTurns =
      direction === RotationDirections.Clockwise
        ? RotationTurns.Quarter
        : RotationTurns.ThreeQuarter
    if (direction === RotationDirections.Clockwise) {
      if (
        processedTile.rotation + TileRotation.QuarterTurn >
        TileRotation.FullTurn
      ) {
        processedTile.rotation = TileRotation.None
      }
      processedTile.rotation += TileRotation.QuarterTurn
    } else {
      if (
        processedTile.rotation - TileRotation.QuarterTurn <
        TileRotation.None
      ) {
        processedTile.rotation = TileRotation.FullTurn
      }
      processedTile.rotation -= TileRotation.QuarterTurn
    }

    processedTile.sides = rotateTileSides(processedTile.sides, quarterTurns)
    processedTile.roadGroups = rotateTileGroups(
      processedTile.roadGroups,
      quarterTurns
    )
    processedTile.cityGroups = rotateTileGroups(
      processedTile.cityGroups,
      quarterTurns
    )
    processedTile.cityShieldGroups = rotateTileGroups(
      processedTile.cityShieldGroups,
      quarterTurns
    )
    processedTile.riverGroups = rotateTileGroups(
      processedTile.riverGroups,
      quarterTurns
    )

    return processedTile
  }

  rotateTileGroups(
    groups: SideName[][] | undefined,
    turns: number
  ): SideName[][] | undefined {
    return rotateTileGroups(groups, turns)
  }

  isEmptyGrid(): boolean {
    return this.lastPlacement.rowIndex === undefined
  }

  clone(): IGameBoard {
    return GameManager.restore(this)
  }

  cloneForSimulation(): IGameBoard {
    const simulationState = {
      ...this,
      tilesList: [],
      tileHistory: [],
      actionsHistory: [],
      completedObjects: {
        cities: [],
        roads: [],
        monasteries: [],
        gardens: [],
      },
    }
    const game = new GameManager({ startImmediately: false })
    Object.assign(game, deepClone(simulationState))
    return game
  }

  static restore(savedGame: IGameBoard): GameManager {
    const game = new GameManager({ startImmediately: false })
    Object.assign(game, deepClone(savedGame))
    return game
  }

  copyStateFrom(source: IGameBoard): void {
    Object.assign(this, deepClone(source))
  }

  simulatePlaceTile(tile: Tile, rowIndex: number, tileIndex: number): boolean {
    const tileDefinition = this.tileManager.findTileDefinition(tile.id)
    const authoritativeTile: Tile | undefined = tileDefinition
      ? { ...tileDefinition, rotation: 0 }
      : tile.id.startsWith('test')
        ? { ...tile }
        : undefined
    if (!authoritativeTile) return false
    if (!tileDefinition && !tile.id.startsWith('test')) return false
    if (
      this.rules.expansions.river &&
      !authoritativeTile.riverGroups?.length &&
      !Object.values(this.tilePlacesStats).some((row) =>
        Object.values(row).some(
          (placedTile) => placedTile.id === TileId.RIVER_L
        )
      )
    ) {
      return false
    }
    if (
      authoritativeTile.expansion === ExpansionName.InnsAndCathedrals &&
      !this.rules.expansions.innsAndCathedrals
    ) {
      return false
    }
    let resolvedTile: Tile
    if (this.tileManager.findTileDefinition(tile.id)) {
      resolvedTile = { ...authoritativeTile, rotation: 0 }
      const turnCount = TileRotation.FullTurn / TileRotation.QuarterTurn
      const normalizedTurns =
        ((Math.round(tile.rotation / TileRotation.QuarterTurn) % turnCount) +
          turnCount) %
        turnCount
      for (let turn = 0; turn < normalizedTurns; turn++) {
        resolvedTile = this.rotateTile(resolvedTile)
      }
    } else {
      resolvedTile = { ...authoritativeTile }
    }
    resolvedTile.hasGarden = tile.hasGarden ?? resolvedTile.hasGarden
    tile = resolvedTile
    const isCorrectPosition = this.tileManager.isValidTilePlacement(
      tile,
      rowIndex,
      tileIndex
    )

    if (!isCorrectPosition) {
      return false
    }

    const placedTile: GridTile = { ...tile, x: tileIndex, y: rowIndex }

    if (!this.tilePlacesStats[rowIndex]) {
      this.tilePlacesStats[rowIndex] = {}
    }
    this.tilePlacesStats[rowIndex][tileIndex] = placedTile

    this.checkGridAfterPlacingTile(rowIndex, tileIndex)
    const placedGridTile = this.tilePlacesStats[rowIndex][tileIndex]
    this.availableFollowersPlaces =
      this.findAvailableFollowersPlaces(placedGridTile)
    return true
  }

  simulatePlaceFollower(
    availablePlace: AvailableFollowerPlace,
    followerType: FollowerType = FollowerTypes.Follower
  ): boolean {
    return this.followerManager.simulatePlaceFollower(
      availablePlace,
      followerType
    )
  }
}

export default GameManager
