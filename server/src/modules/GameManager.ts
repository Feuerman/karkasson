import tiles, { gardenTileCounts } from '../data/tiles'
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
} from './scoring'
import {
  ActionTypes,
  ObjectTypes,
  type AvailableFollowerPlace,
  type AvailablePlace,
  type BaseObject,
  type CompletedObjects,
  type FollowerCount,
  type FollowerType,
  type GridTile,
  type ObjectFollower,
  type Player,
  type PlayerId,
  type PlacedFollower,
  type Point,
  type PointDirection,
  type RotationDirection,
  type ScoreForObject,
  type Scores,
  type SideName,
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
  calcScoreForCity(city: BaseObject): ScoreForObject
  calcScoreForRoad(road: BaseObject): ScoreForObject
  getNextPlayer(currentPlayerId: PlayerId | undefined): Player
  clone(): IGameBoard
  copyStateFrom(source: IGameBoard): void
  simulatePlaceTile(tile: Tile, rowIndex: number, tileIndex: number): boolean
  simulatePlaceFollower(
    place: AvailableFollowerPlace,
    followerType?: FollowerType
  ): boolean
  getTileFeatureGroups(tile: Tile, feature: 'city' | 'road'): SideName[][]
  rotateTileGroups(
    groups: SideName[][] | undefined,
    turns: number
  ): SideName[][] | undefined
}

type CentralObjectKind = 'monastery' | 'garden'
type LinearFeatureKind = 'road' | 'city'

const LINEAR_FEATURE_COLLECTIONS = {
  road: 'roads',
  city: 'cities',
} as const

const LINEAR_FEATURE_TYPES = {
  road: ObjectTypes.ROAD,
  city: ObjectTypes.CITY,
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

const CENTRAL_OBJECT_COLLECTIONS = {
  monastery: 'monasteries',
  garden: 'gardens',
} as const

const CENTRAL_OBJECT_TYPES = {
  monastery: ObjectTypes.MONASTERY,
  garden: ObjectTypes.GARDEN,
} as const

export class GameManager implements IGameBoard {
  id?: string
  roomCode?: string
  gridSize = [30, 30]
  gameIsStarted: boolean
  gameIsEnded: boolean
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

  constructor(params: { players?: Player[]; startImmediately?: boolean } = {}) {
    const players = params.players ?? []

    this.gameIsStarted = false
    this.gameIsEnded = false
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
    this.tilesList = tiles
      .flatMap<Tile>((tile) => {
        const gardenCount = gardenTileCounts[tile.id] ?? 0
        return Array.from({ length: tile.count }, (_, index) => {
          const copy: Tile = { ...tile, rotation: 0 }
          if (index < gardenCount) copy.hasGarden = true
          return copy
        })
      })
      .sort(() => Math.random() - 0.5)
  }

  initPlayers(players: Player[]) {
    players.forEach((player) => {
      this.players.push(player)
      this.scores[player.id] = 0
    })

    this.playersFollowers = players.reduce<Record<PlayerId, FollowerCount>>(
      (acc, player) => {
        acc[player.id] = { ordinaryFollowers: 7, monks: 1 }
        return acc
      },
      {}
    )
  }

  startGame() {
    this.gameIsStarted = true
    this.placeStartTile()
    this.currentPlayer = this.players[0] ?? null
    this.currentPlayerIndex = 0
  }

  placeStartTile() {
    const centerCoordinates = {
      rowIndex: Math.floor(this.gridSize[1] / 2),
      tileIndex: Math.floor(this.gridSize[0] / 2),
    }

    const startTileIndex = this.tilesList.findIndex((tile) => tile.id === 'D')
    const startTile = { ...this.tilesList[startTileIndex] }

    this.tilesList.splice(startTileIndex, 1)

    this.tileHistory.push(deepClone(startTile))

    this.placeTile(
      startTile,
      centerCoordinates.rowIndex,
      centerCoordinates.tileIndex
    )
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

    const sides: PointDirection[] = Object.keys(tile.sides) as SideName[]
    if (tile.isMonastery || tile.hasGarden) {
      sides.push('center')
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
          pointType: side === 'center' ? undefined : tile.sides[side],
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
      if (side && side !== 'center') {
        const tileSideType = tile.sides[side]
        const featureGroups = this.getTileFeatureGroups(
          tile,
          tileSideType === 'city' ? 'city' : 'road'
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
      return true
    })
  }

  placeTile(tile: Tile, rowIndex: number, tileIndex: number): boolean {
    if (this.gameIsEnded) return false

    const isCorrectPosition = this.isCorrectTilePosition(
      tile,
      rowIndex,
      tileIndex
    )

    if (!isCorrectPosition) {
      return false
    }

    if (this.currentTile) {
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

    this.checkAvailableFollowers()

    if (!this.currentPlayer) {
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
        north: {
          rowIndex: tile.rowIndex - 1,
          tileIndex: tile.tileIndex,
          side: 'south',
        },
        east: {
          rowIndex: tile.rowIndex,
          tileIndex: tile.tileIndex + 1,
          side: 'west',
        },
        south: {
          rowIndex: tile.rowIndex + 1,
          tileIndex: tile.tileIndex,
          side: 'north',
        },
        west: {
          rowIndex: tile.rowIndex,
          tileIndex: tile.tileIndex - 1,
          side: 'east',
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
      (!followerPool.ordinaryFollowers && !followerPool.monks)
    ) {
      this.endTurn()
    } else {
      this.currentTile = null
      this.isPlacingFollower = true
    }
  }

  placeFollower(
    availablePlace: AvailableFollowerPlace,
    followerType: FollowerType = 'follower'
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
    const isAbbot = followerType === 'abbot'
    const isCenterFeature = Boolean(
      temporaryObject.isMonastery || temporaryObject.isGarden
    )
    if (isAbbot) {
      if (!followerPool.monks || !isCenterFeature) {
        this.skipFollower()
        return
      }
    } else if (!followerPool.ordinaryFollowers || temporaryObject.isGarden) {
      // На сад можно поставить только аббата
      this.skipFollower()
      return
    }

    if (isAbbot) {
      this.playersFollowers[activePlayer.id].monks -= 1
    } else {
      this.playersFollowers[activePlayer.id].ordinaryFollowers -= 1
    }

    temporaryObject.followers.push({
      playerId: activePlayer.id,
      objectId: temporaryObject.id,
      point: availablePlace.point,
      isAbbot: isAbbot || undefined,
    })

    this.placedFollowers.push({
      playerId: activePlayer.id,
      objectId: temporaryObject.id,
      point: availablePlace.point,
      isMonastery: temporaryObject.isMonastery,
      isGarden: temporaryObject.isGarden,
      isAbbot: isAbbot || undefined,
    })

    this.availableFollowersPlaces = []

    this.actionsHistory.push({
      actionType: ActionTypes.PLACE_FOLLOWER,
      actionData: {
        ...availablePlace,
        followerType: isAbbot ? 'abbot' : 'follower',
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
    direction?: SideName | 'center'
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
      for (let turn = 0; turn < move.rotation / 90; turn++) {
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
    if (!this.tilesList.length) {
      this.gameIsEnded = true
      this.currentTile = null
      return
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

  checkAvailablePlacesForTile(tile: Tile): boolean {
    return this.availablePlacesTiles.some((place) => {
      return [0, 1, 2, 3].some((rotationCount) => {
        let processedTile: Tile = { ...tile }
        for (let i = 0; i < rotationCount; i++) {
          processedTile = this.rotateTile(processedTile)
        }

        return this.isCorrectTilePosition(
          processedTile,
          place.rowIndex,
          place.tileIndex
        )
      })
    })
  }

  updateTileHistory(tile: Tile) {
    this.tileHistory.push(deepClone(tile))
  }

  checkGridAfterPlacingTile(rowIndex: number, tileIndex: number) {
    const tile = this.tilePlacesStats[rowIndex]?.[tileIndex]
    if (!tile) return

    const roadsPoints = this.getFeaturePoints(tile, rowIndex, tileIndex, 'road')
    this.checkRoads(
      roadsPoints,
      this.getConnectedFeatureGroups(tile, roadsPoints, 'road')
    )

    const citiesPoints = this.getFeaturePoints(
      tile,
      rowIndex,
      tileIndex,
      'city'
    )
    this.checkCities(
      citiesPoints,
      this.getConnectedFeatureGroups(tile, citiesPoints, 'city')
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
            direction: 'center',
            rowIndex: tile.y,
            tileIndex: tile.x,
          },
        ],
      })
    }

    this.checkCompletedMonasteries()
  }

  checkCompletedMonasteries() {
    this.checkCompletedCentralObjects('monastery')
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
            direction: 'center',
            rowIndex: tile.y,
            tileIndex: tile.x,
          },
        ],
      })
    }

    this.checkCompletedGardens()
  }

  checkCompletedGardens() {
    this.checkCompletedCentralObjects('garden')
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
    return Object.entries(tile.sides)
      .filter(([, pointType]) => pointType === feature)
      .map(([direction]) => ({
        y: rowIndex,
        x: tileIndex,
        direction: direction as PointDirection,
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
            directions.includes(point.direction as SideName)
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
        this.playersFollowers[follower.playerId].ordinaryFollowers += 1
        this.removePlacedFollower(follower)
        this.actionsHistory.push({
          actionType: ActionTypes.BACK_FOLLOWER,
          actionData: { followers: [follower] },
        })
      }
    }
  }

  checkRoads(roadsPoints: Point[], connectedGroups?: Point[][]) {
    this.checkConnectedFeatures('road', roadsPoints, connectedGroups)
  }

  mergeRoads(roadsIds: string[], roadsPoints: Point[]) {
    this.mergeLinearFeature('road', roadsIds, roadsPoints)
  }

  checkCompleteRoad(road: BaseObject) {
    this.checkCompleteLinearFeature('road', road)
  }

  calcScoreForRoad(road: BaseObject, _isCompleted = true): ScoreForObject {
    return calcRoadScore(this.tilePlacesStats, road, this.scores)
  }

  checkCities(citiesPoints: Point[], connectedGroups?: Point[][]) {
    this.checkConnectedFeatures('city', citiesPoints, connectedGroups)
  }

  mergeCities(citiesIds: string[], citiesPoints: Point[]) {
    this.mergeLinearFeature('city', citiesIds, citiesPoints)
  }

  checkCompleteCity(city: BaseObject) {
    this.checkCompleteLinearFeature('city', city)
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

    if (connectedIds.length === 1) {
      const existingObject = existingObjects.find(
        ({ id }) => id === connectedIds[0]
      )
      if (!existingObject) return

      existingObject.points = existingObject.points.concat(newPoints)
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
      kind === 'road'
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
      this.playersFollowers[follower.playerId].ordinaryFollowers += 1
      this.removePlacedFollower(follower)
    }

    if (feature.followers.length) {
      this.actionsHistory.push({
        actionType: ActionTypes.BACK_FOLLOWER,
        actionData: { followers: feature.followers },
      })
    }
  }

  calcScoreForCity(city: BaseObject, _isCompleted = true): ScoreForObject {
    return calcCityScore(this.tilePlacesStats, city, this.scores)
  }

  private removePlacedFollower(follower: ObjectFollower) {
    const index = this.placedFollowers.findIndex(
      (placed) =>
        String(placed.playerId) === String(follower.playerId) &&
        placed.point.x === follower.point.x &&
        placed.point.y === follower.point.y &&
        placed.point.direction === follower.point.direction &&
        Boolean(placed.isAbbot) === Boolean(follower.isAbbot)
    )
    if (index >= 0) this.placedFollowers.splice(index, 1)
  }

  private isFollowerPlacementAvailable(
    place: AvailableFollowerPlace,
    object: BaseObject
  ): boolean {
    const side = place.point.direction
    if (!side || side === 'center') return object.followers.length === 0

    const tile = this.tilePlacesStats[place.point.y]?.[place.point.x]
    if (!tile) return false
    const type = tile.sides[side]
    const groups = this.getTileFeatureGroups(
      tile,
      type === 'city' ? 'city' : 'road'
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
          Boolean(candidate.isAbbot) === Boolean(follower.isAbbot)
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

  getTileFeatureGroups(tile: Tile, feature: 'city' | 'road'): SideName[][] {
    const featureSides = (Object.keys(tile.sides) as SideName[]).filter(
      (side) => tile.sides[side] === feature
    )

    // Все ответвления дороги, сходящиеся в перекрёстке, заканчиваются на
    // нём независимо друг от друга. Правило определяется формой тайла, а не
    // его ID или вручную заданной группой в каталоге.
    if (feature === 'road' && featureSides.length >= 3) {
      return featureSides.map((side) => [side])
    }

    const tileGroups = feature === 'city' ? tile.cityGroups : tile.roadGroups
    const definition = tiles.find(({ id }) => id === tile.id)
    const definitionGroups =
      feature === 'city' ? definition?.cityGroups : definition?.roadGroups
    const groups =
      tileGroups ??
      this.rotateTileGroups(definitionGroups, Math.round(tile.rotation / 90)) ??
      []

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

  rotateTile(tile: Tile, direction: RotationDirection = 'clockwise'): Tile {
    const processedTile = { ...tile }
    const quarterTurns = direction === 'clockwise' ? 1 : 3
    if (direction === 'clockwise') {
      if (processedTile.rotation + 90 > 360) {
        processedTile.rotation = 0
      }
      processedTile.rotation += 90
    } else {
      if (processedTile.rotation - 90 < 0) {
        processedTile.rotation = 360
      }
      processedTile.rotation -= 90
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

  static restore(savedGame: IGameBoard): GameManager {
    const game = new GameManager({ startImmediately: false })
    Object.assign(game, deepClone(savedGame))
    return game
  }

  copyStateFrom(source: IGameBoard): void {
    Object.assign(this, deepClone(source))
  }

  simulatePlaceTile(tile: Tile, rowIndex: number, tileIndex: number): boolean {
    const isCorrectPosition = this.isCorrectTilePosition(
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
    followerType: FollowerType = 'follower'
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

    const isAbbot = followerType === 'abbot'
    const isCenterFeature = Boolean(
      targetObject.isMonastery || targetObject.isGarden
    )
    if (isAbbot) {
      if (!followerPool.monks || !isCenterFeature) return false
    } else if (!followerPool.ordinaryFollowers || targetObject.isGarden) {
      return false
    }

    if (isAbbot) {
      this.playersFollowers[currentPlayer.id].monks -= 1
    } else {
      this.playersFollowers[currentPlayer.id].ordinaryFollowers -= 1
    }

    targetObject.followers.push({
      playerId: currentPlayer.id,
      objectId: targetObject.id,
      point: availablePlace.point,
      isAbbot: isAbbot || undefined,
    })

    this.placedFollowers.push({
      playerId: currentPlayer.id,
      objectId: targetObject.id,
      point: availablePlace.point,
      isMonastery: targetObject.isMonastery,
      isGarden: targetObject.isGarden,
      isAbbot: isAbbot || undefined,
    })

    return true
  }
}

export default GameManager
