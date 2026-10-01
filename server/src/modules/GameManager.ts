import tiles from '../data/tiles'
import { innsAndCathedralsTiles } from '../data/innsAndCathedralsTiles'
import { riverTiles } from '../data/riverTiles'
import { deepClone } from '../utils/common'
import { GameSimulatorModule } from './GameSimulatorModule'
import {
  getPrecisionCoordinates,
  isCorrectTilePosition,
  isOppositePoint,
} from './gameGeometry'
import { rotateTileGroups, rotateTileSides } from './tileRotation'
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
  PointDirection as PointDirections,
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

type CentralObjectKind = ObjectTypes.MONASTERY | ObjectTypes.GARDEN
type LinearFeatureKind = typeof TileSideType.Road | typeof TileSideType.City

const LINEAR_FEATURE_COLLECTIONS = {
  [TileSideType.Road]: 'roads',
  [TileSideType.City]: 'cities',
} as const

const LINEAR_FEATURE_TYPES = {
  [TileSideType.Road]: ObjectTypes.ROAD,
  [TileSideType.City]: ObjectTypes.CITY,
} as const

const CENTRAL_OBJECT_NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
]

const CENTRAL_OBJECT_COLLECTIONS: Record<
  CentralObjectKind,
  'monasteries' | 'gardens'
> = {
  [ObjectTypes.MONASTERY]: 'monasteries',
  [ObjectTypes.GARDEN]: 'gardens',
} as const

const CENTRAL_OBJECT_TYPES: Record<CentralObjectKind, CentralObjectKind> = {
  [ObjectTypes.MONASTERY]: ObjectTypes.MONASTERY,
  [ObjectTypes.GARDEN]: ObjectTypes.GARDEN,
} as const

function shuffleTiles(tiles: Tile[]): Tile[] {
  for (let index = tiles.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const tile = tiles[index]
    tiles[index] = tiles[randomIndex]
    tiles[randomIndex] = tile
  }
  return tiles
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
  private isPlacingStartTile = false

  constructor(
    params: {
      players?: Player[]
      startImmediately?: boolean
      finalScoringEnabled?: boolean
      innsAndCathedralsEnabled?: boolean
      riverEnabled?: boolean
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

    this.initTilesList()
    this.initPlayers(players)

    if (params.startImmediately !== false) this.startGame()
  }

  initTilesList() {
    const standardDefinitions = this.rules.expansions.innsAndCathedrals
      ? [...tiles, ...innsAndCathedralsTiles]
      : tiles
    const standardTiles = standardDefinitions.flatMap<Tile>((tile) => {
      return Array.from({ length: tile.count }, (_, index) => {
        const copy: Tile = { ...tile, rotation: 0 }
        if (index < (tile.gardenCount ?? 0)) copy.hasGarden = true
        return copy
      })
    })
    shuffleTiles(standardTiles)

    if (!this.rules.expansions.river) {
      this.tilesList = standardTiles
      return
    }

    const middleRiverTiles = riverTiles
      .filter((tile) => tile.id !== TileId.RIVER_L)
      .flatMap<Tile>((tile) => {
        return Array.from({ length: tile.count }, (_, index) => {
          const copy: Tile = { ...tile, rotation: 0 }
          if (index < (tile.gardenCount ?? 0)) copy.hasGarden = true
          return copy
        })
      })
    shuffleTiles(middleRiverTiles)
    const riverEnd = riverTiles.find(({ id }) => id === TileId.RIVER_L)
    if (!riverEnd) throw new Error('River expansion has no ending tile')

    this.tilesList = [
      ...middleRiverTiles,
      { ...riverEnd, rotation: 0 },
      ...standardTiles,
    ]
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

    const nextPlayer = this.getNextPlayer(currentPlayer?.id)

    this.currentPlayer = nextPlayer
    this.currentPlayerIndex = this.players.findIndex(
      (player) => player.id === nextPlayer.id
    )

    this.getRandomTileFromList()
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
    if (!this.currentTile) return
    const currentPlayer = this.currentPlayer
    if (!currentPlayer) return
    const tile = this.currentTile

    const followerPool = this.playersFollowers[currentPlayer.id]
    if (
      followerPool &&
      !followerPool.ordinaryFollowers &&
      !(this.rules.expansions.innsAndCathedrals && followerPool.bigFollowers) &&
      !followerPool.monks
    ) {
      this.endTurn()
      return
    }

    this.availableFollowersPlaces = this.findAvailableFollowersPlaces(tile)

    if (this.availableFollowersPlaces.length) {
      this.goPlaceFollower()
    } else {
      this.endTurn()
    }
  }

  private findAvailableFollowersPlaces(
    tile: GridTile
  ): AvailableFollowerPlace[] {
    const currentPlayer = this.currentPlayer
    if (!currentPlayer) return []
    const followerPool = this.playersFollowers[currentPlayer.id]

    const sides: PointDirection[] = [...SIDE_NAMES]
    if (tile.isMonastery || tile.hasGarden) {
      sides.push(PointDirections.Center)
    }

    const candidates: {
      point: Point
      temporaryObject: BaseObject | undefined
    }[] = sides.map((side) => {
      return {
        point: {
          x: tile.x,
          y: tile.y,
          direction: side,
          pointType:
            side === PointDirections.Center ? undefined : tile.sides[side],
        },
        temporaryObject: this.findObjectByPoint(
          this.temporaryObjects,
          tile.x,
          tile.y,
          side
        ),
      }
    })

    return candidates.filter((place): place is AvailableFollowerPlace => {
      const object = place.temporaryObject
      if (object === undefined || object.followers.length !== 0) {
        return false
      }
      const side = place.point.direction
      if (side && side !== PointDirections.Center) {
        const tileSideType = tile.sides[side]
        const featureGroups = this.getTileFeatureGroups(
          tile,
          tileSideType === TileSideType.City
            ? TileSideType.City
            : TileSideType.Road
        )
        const group = featureGroups.find((directions) =>
          directions.includes(side)
        ) ?? [side]
        const connectedObjects = group
          .map((direction) =>
            this.findObjectByPoint(
              this.temporaryObjects,
              tile.x,
              tile.y,
              direction
            )
          )
          .filter((candidate): candidate is BaseObject => Boolean(candidate))
        if (
          connectedObjects.some((candidate) => candidate.followers.length > 0)
        ) {
          return false
        }
      }
      // На сад можно поставить только аббата — предлагаем его лишь при
      // наличии свободного аббата в запасе.
      if (object.isGarden && !followerPool?.monks) {
        return false
      }
      if (place.point.direction === PointDirections.Center || object.isGarden) {
        return Boolean(followerPool?.monks)
      }
      if (
        followerPool &&
        !followerPool.ordinaryFollowers &&
        !(this.rules.expansions.innsAndCathedrals && followerPool.bigFollowers)
      ) {
        return false
      }
      return true
    })
  }

  placeTile(tile: Tile, rowIndex: number, tileIndex: number): boolean {
    if (this.gameIsEnded) return false
    const tileDefinition = this.findTileDefinition(tile.id)
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
    resolvedTile.hasGarden =
      this.currentTile?.id === tile.id
        ? (this.currentTile.hasGarden ?? resolvedTile.hasGarden)
        : (tile.hasGarden ?? resolvedTile.hasGarden)
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

    const isCorrectPosition = this.isValidTilePlacement(
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

    if (!this.isPlacingStartTile) this.checkAvailableFollowers()

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
    const currentPlayer = this.currentPlayer
    const followerPool = currentPlayer
      ? this.playersFollowers[currentPlayer.id]
      : null
    if (
      !currentPlayer ||
      !followerPool ||
      (!followerPool.ordinaryFollowers &&
        !(
          this.rules.expansions.innsAndCathedrals && followerPool.bigFollowers
        ) &&
        !followerPool.monks)
    ) {
      this.endTurn()
    } else {
      this.currentTile = null
      this.isPlacingFollower = true
    }
  }

  placeFollower(
    availablePlace: AvailableFollowerPlace,
    followerType: FollowerType = FollowerTypes.Follower
  ) {
    if (this.gameIsEnded) return
    const activePlayer = this.currentPlayer
    if (!activePlayer) return

    const followerPool = this.playersFollowers[activePlayer.id]
    if (!followerPool) {
      this.skipFollower()
      return
    }

    const temporaryObject = this.findObjectByPoint(
      this.temporaryObjects,
      availablePlace.point.x,
      availablePlace.point.y,
      availablePlace.point.direction
    )

    if (
      !temporaryObject ||
      temporaryObject.id !== availablePlace.temporaryObject.id ||
      temporaryObject.followers.length > 0
    ) {
      this.skipFollower()
      return
    }
    if (!this.isFollowerPlacementAvailable(availablePlace, temporaryObject)) {
      this.skipFollower()
      return
    }

    // Валидация пула и целевого объекта до списания фишки
    const isAbbot = followerType === FollowerTypes.Abbot
    const isBigFollower = followerType === FollowerTypes.BigFollower
    const isCenterFeature = Boolean(
      temporaryObject.isMonastery || temporaryObject.isGarden
    )
    if (isAbbot) {
      if (!followerPool.monks || !isCenterFeature) {
        this.skipFollower()
        return
      }
    } else if (
      (isBigFollower
        ? !this.rules.expansions.innsAndCathedrals || !followerPool.bigFollowers
        : !followerPool.ordinaryFollowers) ||
      temporaryObject.isGarden ||
      (isBigFollower && !this.rules.expansions.innsAndCathedrals)
    ) {
      // На сад можно поставить только аббата
      this.skipFollower()
      return
    }

    if (isAbbot) {
      this.playersFollowers[activePlayer.id].monks -= 1
    } else if (isBigFollower) {
      const pool = this.playersFollowers[activePlayer.id]
      if (pool.bigFollowers !== undefined) pool.bigFollowers -= 1
    } else {
      this.playersFollowers[activePlayer.id].ordinaryFollowers -= 1
    }

    temporaryObject.followers.push({
      playerId: activePlayer.id,
      objectId: temporaryObject.id,
      point: availablePlace.point,
      isAbbot: isAbbot || undefined,
      isBigFollower: isBigFollower || undefined,
    })

    this.placedFollowers.push({
      playerId: activePlayer.id,
      objectId: temporaryObject.id,
      point: availablePlace.point,
      isMonastery: temporaryObject.isMonastery,
      isGarden: temporaryObject.isGarden,
      isAbbot: isAbbot || undefined,
      isBigFollower: isBigFollower || undefined,
    })

    this.availableFollowersPlaces = []

    this.actionsHistory.push({
      actionType: ActionTypes.PLACE_FOLLOWER,
      actionData: {
        ...availablePlace,
        followerType: isAbbot
          ? FollowerTypes.Abbot
          : isBigFollower
            ? FollowerTypes.BigFollower
            : FollowerTypes.Follower,
      },
      initiator: activePlayer,
    })

    this.endTurn()
  }

  skipFollower() {
    this.availableFollowersPlaces = []
    this.endTurn()
  }

  /**
   * Отзыв аббата в ход владельца: аббат снимается с монастыря или сада
   * (завершённого или нет) и начисляются очки за «незавершённый» объект —
   * 1 очко за сам тайл и по 1 очку за каждую занятую клетку в окрестности 3×3.
   * Ход не расходуется: игрок после отзыва продолжает свой ход.
   */
  recallAbbot(): boolean {
    if (this.gameIsEnded) return false
    const currentPlayer = this.currentPlayer
    if (!currentPlayer) return false

    const playerKey = String(currentPlayer.id)
    const centerObjects = [
      ...this.temporaryObjects.monasteries,
      ...this.completedObjects.monasteries,
      ...this.temporaryObjects.gardens,
      ...this.completedObjects.gardens,
    ]
    const target = centerObjects.find((m) =>
      m.followers.some((f) => f.isAbbot && String(f.playerId) === playerKey)
    )
    if (!target) return false

    const abbot = target.followers.find(
      (f) => f.isAbbot && String(f.playerId) === playerKey
    )
    if (!abbot) return false

    const points = target.isGarden
      ? calcGardenPoints(this.tilePlacesStats, target)
      : calcMonasteryPoints(this.tilePlacesStats, target)
    this.scores[currentPlayer.id] =
      (this.scores[currentPlayer.id] ?? 0) + points

    this.actionsHistory.push({
      actionType: ActionTypes.ADDING_SCORES,
      actionData: {
        objectType: target.isGarden
          ? ObjectTypes.GARDEN
          : ObjectTypes.MONASTERY,
        objectData: target,
        score: {
          objectId: target.id,
          players: { [currentPlayer.id]: points },
          total: points,
        },
      },
    })

    target.followers = target.followers.filter((f) => f !== abbot)
    const placedIndex = this.placedFollowers.findIndex(
      (f) =>
        f.isAbbot &&
        f.objectId === target.id &&
        String(f.playerId) === playerKey
    )
    if (placedIndex !== -1) {
      this.placedFollowers.splice(placedIndex, 1)
    }

    this.playersFollowers[currentPlayer.id].monks += 1

    this.actionsHistory.push({
      actionType: ActionTypes.BACK_FOLLOWER,
      actionData: { followers: [abbot] },
    })

    return true
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
    if (!this.tilesList.length) {
      this.finishGame()
      return
    }

    const hasRiverEnd = Object.values(this.tilePlacesStats).some((row) =>
      Object.values(row).some((placedTile) => placedTile.id === TileId.RIVER_L)
    )
    if (this.rules.expansions.river && !hasRiverEnd) {
      const nextRiverTile = this.tilesList[0]
      if (!nextRiverTile || nextRiverTile.expansion !== ExpansionName.River) {
        this.finishGame()
        return
      }

      this.tilesList.shift()
      const tile = { ...nextRiverTile, rotation: 0 }
      this.currentTile = { x: 0, y: 0, ...tile }
      this.updateTileHistory(tile)
      return
    }

    if (this.rules.expansions.river && hasRiverEnd) {
      this.tilesList = this.tilesList.filter(
        (tile) => tile.expansion !== ExpansionName.River
      )
    }

    const tile = this.tilesList[0]

    if (this.checkAvailablePlacesForTile({ ...tile, rotation: 0 })) {
      this.tilesList.shift()
      this.currentTile = { x: 0, y: 0, ...tile, rotation: 0 }
      this.updateTileHistory(tile)
    } else {
      const listWithoutCurrentTile = this.tilesList.filter(
        (_, index) => index !== 0
      )
      this.tilesList = [...listWithoutCurrentTile, tile]
      this.getRandomTileFromList()
    }
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
    return Boolean(this.getValidTileRotation(tile))
  }

  private getValidTileRotation(tile: Tile): Tile | undefined {
    for (const place of this.availablePlacesTiles) {
      for (const rotationCount of [0, 1, 2, 3]) {
        let processedTile: Tile = { ...tile }
        for (let i = 0; i < rotationCount; i++) {
          processedTile = this.rotateTile(processedTile)
        }

        if (
          this.isValidTilePlacement(
            processedTile,
            place.rowIndex,
            place.tileIndex
          )
        ) {
          return processedTile
        }
      }
    }
    return undefined
  }

  private isValidTilePlacement(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): boolean {
    if (this.rules.expansions.river && tile.expansion === ExpansionName.River) {
      return (
        !this.tilePlacesStats[rowIndex]?.[tileIndex] &&
        this.isValidRiverPlacement(tile, rowIndex, tileIndex)
      )
    }

    return (
      this.isCorrectTilePosition(tile, rowIndex, tileIndex) &&
      this.isValidRiverPlacement(tile, rowIndex, tileIndex)
    )
  }

  private isValidRiverPlacement(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): boolean {
    if (!this.rules.expansions.river) return true
    if (this.isPlacingStartTile) {
      return tile.id === TileId.RIVER_A && rowIndex === 15 && tileIndex === 15
    }
    if (!Object.keys(this.tilePlacesStats).length) return true
    if (tile.id === TileId.RIVER_A) return false
    const hasRiverEnd = Object.values(this.tilePlacesStats).some((row) =>
      Object.values(row).some((placedTile) => placedTile.id === TileId.RIVER_L)
    )
    if (hasRiverEnd) return !tile.riverGroups?.length
    if (!tile.riverGroups?.length) return false

    const riverSides = tile.riverGroups.flat()
    if (tile.riverGroups.length !== 1) return false
    if (tile.id === TileId.RIVER_A) return false

    const placedRivers = Object.values(this.tilePlacesStats).flatMap((row) =>
      Object.values(row).filter((placedTile) => placedTile.riverGroups?.length)
    )
    if (!placedRivers.length) return false
    if (riverSides.length < 1 || riverSides.length > 2) {
      return false
    }

    const oppositeSide: Record<SideName, SideName> = {
      [SideName.North]: SideName.South,
      [SideName.East]: SideName.West,
      [SideName.South]: SideName.North,
      [SideName.West]: SideName.East,
    }
    const offsets: Record<SideName, { row: number; column: number }> = {
      [SideName.North]: { row: -1, column: 0 },
      [SideName.East]: { row: 0, column: 1 },
      [SideName.South]: { row: 1, column: 0 },
      [SideName.West]: { row: 0, column: -1 },
    }
    const openEnds: Array<{
      rowIndex: number
      tileIndex: number
      side: SideName
    }> = []
    for (const [placedRowIndex, placedRow] of Object.entries(
      this.tilePlacesStats
    )) {
      for (const [placedTileIndex, placedTile] of Object.entries(placedRow)) {
        if (!placedTile.riverGroups?.length) continue
        const placedCoordinates = {
          rowIndex: Number(placedRowIndex),
          tileIndex: Number(placedTileIndex),
        }
        for (const side of placedTile.riverGroups.flat()) {
          const offset = offsets[side]
          const neighbor =
            this.tilePlacesStats[placedCoordinates.rowIndex + offset.row]?.[
              placedCoordinates.tileIndex + offset.column
            ]
          if (
            !neighbor?.riverGroups?.some((group) =>
              group.includes(oppositeSide[side])
            )
          ) {
            openEnds.push({ ...placedCoordinates, side })
          }
        }
      }
    }
    if (openEnds.length !== 1) return false

    const openEnd = openEnds[0]
    const connection = (Object.keys(offsets) as SideName[])
      .map((side) => {
        const offset = offsets[side]
        return {
          side,
          rowIndex: rowIndex + offset.row,
          tileIndex: tileIndex + offset.column,
        }
      })
      .find(
        ({ rowIndex: neighborRow, tileIndex: neighborColumn }) =>
          this.tilePlacesStats[neighborRow]?.[neighborColumn]?.riverGroups
            ?.length
      )
    if (
      !connection ||
      !openEnd ||
      connection.rowIndex !== openEnd.rowIndex ||
      connection.tileIndex !== openEnd.tileIndex ||
      openEnd.side !== oppositeSide[connection.side] ||
      !riverSides.includes(connection.side)
    ) {
      return false
    }

    // Река движется только вправо или вниз: вход приходит сверху/слева,
    // а выход продолжается вниз/вправо. Это исключает петли к истоку.
    if (
      (connection.side !== SideName.North &&
        connection.side !== SideName.West) ||
      (tile.id !== TileId.RIVER_L &&
        !riverSides.some(
          (side) => side === SideName.East || side === SideName.South
        ))
    ) {
      return false
    }

    if (
      tile.id === TileId.RIVER_L
        ? riverSides.length !== 1
        : riverSides.length !== 2
    ) {
      return false
    }

    return true
  }

  updateTileHistory(tile: Tile) {
    this.tileHistory.push(deepClone(tile))
  }

  checkGridAfterPlacingTile(rowIndex: number, tileIndex: number) {
    const tile = this.tilePlacesStats[rowIndex]?.[tileIndex]
    if (!tile) return

    const roadsPoints = this.getFeaturePoints(
      tile,
      rowIndex,
      tileIndex,
      TileSideType.Road
    )
    this.checkRoads(
      roadsPoints,
      this.getConnectedFeatureGroups(tile, roadsPoints, TileSideType.Road)
    )

    const citiesPoints = this.getFeaturePoints(
      tile,
      rowIndex,
      tileIndex,
      TileSideType.City
    )
    this.checkCities(
      citiesPoints,
      this.getConnectedFeatureGroups(tile, citiesPoints, TileSideType.City)
    )

    this.checkMonasteries(tile)

    this.checkGardens(tile)
  }

  checkMonasteries(tile: GridTile) {
    if (tile.isMonastery) {
      this.temporaryObjects.monasteries.push({
        followers: [],
        id: 'id' + Math.random(),
        isMonastery: true,
        points: [
          {
            x: tile.x,
            y: tile.y,
            direction: PointDirections.Center,
            rowIndex: tile.y,
            tileIndex: tile.x,
          },
        ],
      })
    }

    this.checkCompletedMonasteries()
  }

  checkCompletedMonasteries() {
    this.checkCompletedCentralObjects(ObjectTypes.MONASTERY)
  }

  calcScoreForMonasteries(monasteries: BaseObject[]) {
    this.calcScoreForCentralObjects(monasteries, ObjectTypes.MONASTERY)
  }

  checkGardens(tile: GridTile) {
    if (tile.hasGarden) {
      this.temporaryObjects.gardens.push({
        followers: [],
        id: 'id' + Math.random(),
        isGarden: true,
        points: [
          {
            x: tile.x,
            y: tile.y,
            direction: PointDirections.Center,
            rowIndex: tile.y,
            tileIndex: tile.x,
          },
        ],
      })
    }

    this.checkCompletedGardens()
  }

  checkCompletedGardens() {
    this.checkCompletedCentralObjects(ObjectTypes.GARDEN)
  }

  calcScoreForGardens(gardens: BaseObject[]) {
    this.calcScoreForCentralObjects(gardens, ObjectTypes.GARDEN)
  }

  private getFeaturePoints(
    tile: GridTile,
    rowIndex: number,
    tileIndex: number,
    feature: LinearFeatureKind
  ): Point[] {
    return SIDE_NAMES.filter(
      (direction) => tile.sides[direction] === feature
    ).map((direction) => ({
      y: rowIndex,
      x: tileIndex,
      direction,
      pointType: feature,
    }))
  }

  private getConnectedFeatureGroups(
    tile: GridTile,
    featurePoints: Point[],
    feature: LinearFeatureKind
  ): Point[][] {
    const featureGroups = this.getTileFeatureGroups(tile, feature)
    return featureGroups
      .map((directions) =>
        featurePoints.filter(
          (point) =>
            point.direction !== undefined &&
            SIDE_NAMES.some(
              (direction) =>
                direction === point.direction && directions.includes(direction)
            )
        )
      )
      .filter((group) => group.length > 0)
  }

  private checkCompletedCentralObjects(kind: CentralObjectKind) {
    const collection = CENTRAL_OBJECT_COLLECTIONS[kind]
    const completedObjects = this.temporaryObjects[collection].filter(
      (object) => {
        const point = object.points[0]
        if (!point) return false

        return CENTRAL_OBJECT_NEIGHBORS.every(([dy, dx]) =>
          Boolean(this.tilePlacesStats[point.y + dy]?.[point.x + dx])
        )
      }
    )

    const completedIds = new Set(completedObjects.map(({ id }) => id))
    this.temporaryObjects[collection] = this.temporaryObjects[
      collection
    ].filter((object) => !completedIds.has(object.id))
    this.completedObjects[collection] = [
      ...this.completedObjects[collection],
      ...completedObjects,
    ]

    if (completedObjects.length) {
      this.calcScoreForCentralObjects(
        completedObjects,
        CENTRAL_OBJECT_TYPES[kind]
      )
    }
  }

  private calcScoreForCentralObjects(
    objects: BaseObject[],
    objectType: ObjectTypes.MONASTERY | ObjectTypes.GARDEN
  ) {
    for (const object of objects) {
      for (const follower of object.followers) {
        // Аббат остаётся на завершённом объекте до отзыва владельцем.
        if (follower.isAbbot) continue

        this.scores[follower.playerId] += 9
        this.actionsHistory.push({
          actionType: ActionTypes.ADDING_SCORES,
          actionData: {
            objectType,
            objectData: object,
            score: {
              objectId: object.id,
              players: { [follower.playerId]: 9 },
              total: 9,
            },
          },
        })
        if (follower.isBigFollower) {
          const pool = this.playersFollowers[follower.playerId]
          if (pool.bigFollowers !== undefined) pool.bigFollowers += 1
        } else {
          this.playersFollowers[follower.playerId].ordinaryFollowers += 1
        }
        this.removePlacedFollower(follower)
        this.actionsHistory.push({
          actionType: ActionTypes.BACK_FOLLOWER,
          actionData: { followers: [follower] },
        })
      }
    }
  }

  checkRoads(roadsPoints: Point[], connectedGroups?: Point[][]) {
    this.checkConnectedFeatures(TileSideType.Road, roadsPoints, connectedGroups)
  }

  mergeRoads(roadsIds: string[], roadsPoints: Point[]) {
    this.mergeLinearFeature(TileSideType.Road, roadsIds, roadsPoints)
  }

  checkCompleteRoad(road: BaseObject) {
    this.checkCompleteLinearFeature(TileSideType.Road, road)
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
    this.checkConnectedFeatures(
      TileSideType.City,
      citiesPoints,
      connectedGroups
    )
  }

  mergeCities(citiesIds: string[], citiesPoints: Point[]) {
    this.mergeLinearFeature(TileSideType.City, citiesIds, citiesPoints)
  }

  checkCompleteCity(city: BaseObject) {
    this.checkCompleteLinearFeature(TileSideType.City, city)
  }

  private checkConnectedFeatures(
    kind: LinearFeatureKind,
    featurePoints: Point[],
    connectedGroups?: Point[][]
  ) {
    const collection = LINEAR_FEATURE_COLLECTIONS[kind]
    const groups = connectedGroups ?? featurePoints.map((point) => [point])

    for (const group of groups) {
      if (!group.length) continue

      const connectedIds = this.temporaryObjects[collection]
        .filter((object) =>
          object.points.some((point) =>
            group.some((featurePoint) =>
              this.isOppositePoint(point, featurePoint)
            )
          )
        )
        .map((object) => object.id)

      this.mergeLinearFeature(kind, connectedIds, group)
    }
  }

  private mergeLinearFeature(
    kind: LinearFeatureKind,
    connectedIds: string[],
    newPoints: Point[]
  ) {
    const collection = LINEAR_FEATURE_COLLECTIONS[kind]
    const existingObjects = this.temporaryObjects[collection]
    const placedTile =
      this.tilePlacesStats[newPoints[0]?.y ?? -1]?.[newPoints[0]?.x ?? -1]
    const hasInn = kind === TileSideType.Road && Boolean(placedTile?.hasInn)
    const hasCathedral =
      kind === TileSideType.City && Boolean(placedTile?.hasCathedral)
    const isExpansionTile = Boolean(
      placedTile?.expansion === ExpansionName.InnsAndCathedrals &&
      (kind === TileSideType.Road ? placedTile.hasInn : placedTile.hasCathedral)
    )

    if (connectedIds.length === 0) {
      const object: BaseObject = {
        id: 'id' + Math.random(),
        points: newPoints,
        followers: [],
        hasInn: hasInn || undefined,
        hasCathedral: hasCathedral || undefined,
        expansion: isExpansionTile
          ? ExpansionName.InnsAndCathedrals
          : undefined,
      }
      this.temporaryObjects[collection].push(object)
      this.checkCompleteLinearFeature(kind, object)
      return
    }

    if (connectedIds.length === 1) {
      const existingObject = existingObjects.find(
        ({ id }) => id === connectedIds[0]
      )
      if (!existingObject) return

      existingObject.points = existingObject.points.concat(newPoints)
      existingObject.hasInn = Boolean(existingObject.hasInn || hasInn)
      existingObject.hasCathedral = Boolean(
        existingObject.hasCathedral || hasCathedral
      )
      if (isExpansionTile)
        existingObject.expansion = ExpansionName.InnsAndCathedrals
      this.checkCompleteLinearFeature(kind, existingObject)
      return
    }

    const connectedIdSet = new Set(connectedIds)
    const connectedObjects = existingObjects.filter(({ id }) =>
      connectedIdSet.has(id)
    )
    const mergedObject: BaseObject = {
      id: 'id' + Math.random(),
      points: connectedObjects
        .flatMap(({ points }) => points)
        .concat(newPoints),
      followers: connectedObjects.flatMap(({ followers }) => followers),
      hasInn: Boolean(
        hasInn ||
        (kind === TileSideType.Road &&
          connectedObjects.some((object) => object.hasInn))
      ),
      hasCathedral: Boolean(
        hasCathedral ||
        (kind === TileSideType.City &&
          connectedObjects.some((object) => object.hasCathedral))
      ),
      expansion:
        isExpansionTile ||
        connectedObjects.some(
          (object) => object.expansion === ExpansionName.InnsAndCathedrals
        )
          ? ExpansionName.InnsAndCathedrals
          : undefined,
    }

    this.temporaryObjects[collection] = existingObjects.filter(
      ({ id }) => !connectedIdSet.has(id)
    )
    this.temporaryObjects[collection].push(mergedObject)
    this.reassignFollowerObjectIds(mergedObject.followers, mergedObject.id)
    this.checkCompleteLinearFeature(kind, mergedObject)
  }

  private checkCompleteLinearFeature(
    kind: LinearFeatureKind,
    feature: BaseObject
  ) {
    const isComplete = feature.points.every((point) => {
      const pointCoordinates = this.getPrecisionCoordinates(point)
      return feature.points.some((otherPoint) => {
        const otherPointCoordinates = this.getPrecisionCoordinates(otherPoint)
        return (
          pointCoordinates.x === otherPointCoordinates.x &&
          pointCoordinates.y === otherPointCoordinates.y &&
          point.direction !== otherPoint.direction
        )
      })
    })
    if (!isComplete) return

    const collection = LINEAR_FEATURE_COLLECTIONS[kind]
    const score =
      kind === TileSideType.Road
        ? this.calcScoreForRoad(feature)
        : this.calcScoreForCity(feature)
    this.temporaryObjects[collection] = this.temporaryObjects[
      collection
    ].filter(({ id }) => id !== feature.id)
    this.completedObjects[collection].push({ ...deepClone(feature), score })

    if (feature.followers.length) {
      this.actionsHistory.push({
        actionType: ActionTypes.ADDING_SCORES,
        actionData: {
          objectType: LINEAR_FEATURE_TYPES[kind],
          objectData: feature,
          score,
        },
      })
    }

    for (const follower of feature.followers) {
      if (follower.isBigFollower) {
        const pool = this.playersFollowers[follower.playerId]
        if (pool.bigFollowers !== undefined) pool.bigFollowers += 1
      } else {
        this.playersFollowers[follower.playerId].ordinaryFollowers += 1
      }
      this.removePlacedFollower(follower)
    }

    if (feature.followers.length) {
      this.actionsHistory.push({
        actionType: ActionTypes.BACK_FOLLOWER,
        actionData: { followers: feature.followers },
      })
    }
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

  private removePlacedFollower(follower: ObjectFollower) {
    const index = this.placedFollowers.findIndex(
      (placed) =>
        String(placed.playerId) === String(follower.playerId) &&
        placed.point.x === follower.point.x &&
        placed.point.y === follower.point.y &&
        placed.point.direction === follower.point.direction &&
        Boolean(placed.isAbbot) === Boolean(follower.isAbbot) &&
        Boolean(placed.isBigFollower) === Boolean(follower.isBigFollower)
    )
    if (index >= 0) this.placedFollowers.splice(index, 1)
  }

  private isFollowerPlacementAvailable(
    place: AvailableFollowerPlace,
    object: BaseObject
  ): boolean {
    const side = place.point.direction
    if (!side || side === PointDirections.Center)
      return object.followers.length === 0

    const tile = this.tilePlacesStats[place.point.y]?.[place.point.x]
    if (!tile) return false
    const type = tile.sides[side]
    const groups = this.getTileFeatureGroups(
      tile,
      type === TileSideType.City ? TileSideType.City : TileSideType.Road
    )
    const group = groups.find((directions) => directions.includes(side)) ?? [
      side,
    ]

    return group.every((direction) => {
      const connectedObject = this.findObjectByPoint(
        this.temporaryObjects,
        place.point.x,
        place.point.y,
        direction
      )
      if (connectedObject) return connectedObject.followers.length === 0
      return object.followers.length === 0
    })
  }

  private reassignFollowerObjectIds(
    followers: ObjectFollower[],
    objectId: string
  ) {
    for (const follower of followers) {
      follower.objectId = objectId
      const placed = this.placedFollowers.find(
        (candidate) =>
          String(candidate.playerId) === String(follower.playerId) &&
          candidate.point.x === follower.point.x &&
          candidate.point.y === follower.point.y &&
          candidate.point.direction === follower.point.direction &&
          Boolean(candidate.isAbbot) === Boolean(follower.isAbbot) &&
          Boolean(candidate.isBigFollower) === Boolean(follower.isBigFollower)
      )
      if (placed) placed.objectId = objectId
    }
  }

  isCorrectTilePosition(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): boolean {
    return isCorrectTilePosition(
      tile,
      rowIndex,
      tileIndex,
      this.tilePlacesStats,
      this.isEmptyGrid()
    )
  }

  getTileFeatureGroups(
    tile: Tile,
    feature: typeof TileSideType.City | typeof TileSideType.Road
  ): SideName[][] {
    const featureSides = SIDE_NAMES.filter(
      (side) => tile.sides[side] === feature
    )

    const definition = this.findTileDefinition(tile.id)
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

  private findTileDefinition(tileId: string) {
    return (
      tiles.find(({ id }) => id === tileId) ??
      (this.rules.expansions.innsAndCathedrals
        ? innsAndCathedralsTiles.find(({ id }) => id === tileId)
        : undefined) ??
      (this.rules.expansions.river
        ? riverTiles.find(({ id }) => id === tileId)
        : undefined)
    )
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
    const tileDefinition = this.findTileDefinition(tile.id)
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
    if (this.findTileDefinition(tile.id)) {
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
    const isCorrectPosition = this.isValidTilePlacement(
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
    const currentPlayer = this.currentPlayer
    const followerPool = currentPlayer
      ? this.playersFollowers[currentPlayer.id]
      : null
    if (!currentPlayer || !followerPool) return false

    const targetObject = this.findObjectByPoint(
      this.temporaryObjects,
      availablePlace.point.x,
      availablePlace.point.y,
      availablePlace.point.direction
    )
    if (
      !targetObject ||
      targetObject.id !== availablePlace.temporaryObject.id ||
      targetObject.followers.length > 0
    ) {
      return false
    }
    if (!this.isFollowerPlacementAvailable(availablePlace, targetObject)) {
      return false
    }

    const isAbbot = followerType === FollowerTypes.Abbot
    const isBigFollower = followerType === FollowerTypes.BigFollower
    const isCenterFeature = Boolean(
      targetObject.isMonastery || targetObject.isGarden
    )
    if (isAbbot) {
      if (!followerPool.monks || !isCenterFeature) return false
    } else if (
      (isBigFollower
        ? !this.rules.expansions.innsAndCathedrals || !followerPool.bigFollowers
        : !followerPool.ordinaryFollowers) ||
      targetObject.isGarden ||
      (isBigFollower && !this.rules.expansions.innsAndCathedrals)
    ) {
      return false
    }

    if (isAbbot) {
      this.playersFollowers[currentPlayer.id].monks -= 1
    } else if (isBigFollower) {
      const pool = this.playersFollowers[currentPlayer.id]
      if (pool.bigFollowers !== undefined) pool.bigFollowers -= 1
    } else {
      this.playersFollowers[currentPlayer.id].ordinaryFollowers -= 1
    }

    targetObject.followers.push({
      playerId: currentPlayer.id,
      objectId: targetObject.id,
      point: availablePlace.point,
      isAbbot: isAbbot || undefined,
      isBigFollower: isBigFollower || undefined,
    })

    this.placedFollowers.push({
      playerId: currentPlayer.id,
      objectId: targetObject.id,
      point: availablePlace.point,
      isMonastery: targetObject.isMonastery,
      isGarden: targetObject.isGarden,
      isAbbot: isAbbot || undefined,
      isBigFollower: isBigFollower || undefined,
    })

    return true
  }
}

export default GameManager
