import tiles from '../data/tiles'
import { deepClone } from '../utils/common'
import { GameSimulatorModule } from './GameSimulatorModule'
import { calcCityScore, calcRoadScore } from './scoring'
import {
  ActionTypes,
  ObjectTypes,
  type AvailableFollowerPlace,
  type AvailablePlace,
  type BaseObject,
  type CompletedObjects,
  type FollowerCount,
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

export type {
  AvailableFollowerPlace,
  AvailablePlacementType,
  RotationDirection,
} from './types'

export interface PlaceTileActionData {
  tile: Tile
  rowIndex: number
  tileIndex: number
}

export interface PlaceFollowerActionData extends AvailableFollowerPlace {}

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
  autoPlay(): Promise<void>
  placeFollower(availablePlace: AvailableFollowerPlace): void
  skipFollower(): void
  placeTile(tile: Tile, rowIndex: number, tileIndex: number): boolean
  autoPlaceTile(): Promise<void>
  calcScoreForCity(city: BaseObject): ScoreForObject
  calcScoreForRoad(road: BaseObject): ScoreForObject
  getNextPlayer(currentPlayerId: PlayerId | undefined): Player
  clone(): IGameBoard
  simulatePlaceTile(tile: Tile, rowIndex: number, tileIndex: number): boolean
  simulatePlaceFollower(place: AvailableFollowerPlace): boolean
}

export class GameManager implements IGameBoard {
  id?: string
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

  constructor(params: { players?: Player[] } = {}) {
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
    this.temporaryObjects = { cities: [], roads: [], monasteries: [] }
    this.completedObjects = { cities: [], roads: [], monasteries: [] }
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

    this.startGame()
  }

  initTilesList() {
    this.tilesList = tiles
      .reduce<Tile[]>((acc, tile) => {
        const copies = Array<Tile>(tile.count).fill({ ...tile, rotation: 0 })
        return [...acc, ...copies]
      }, [])
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

    const startTileIndex = this.tilesList.findIndex((tile) => tile.id === 'E')
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

    if (!this.playersFollowers[currentPlayer.id].ordinaryFollowers) {
      this.endTurn()
      return
    }

    const sides: (SideName | undefined)[] = Object.keys(
      tile.sides
    ) as SideName[]
    if (tile.isMonastery) {
      sides.push(undefined)
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
          pointType: side ? tile.sides[side] : undefined,
        },
        temporaryObject: this.findObjectByPoint(
          this.temporaryObjects,
          tile.x,
          tile.y,
          side
        ),
      }
    })

    this.availableFollowersPlaces = candidates.filter(
      (place): place is AvailableFollowerPlace => {
        const object = place.temporaryObject
        return object !== undefined && object.followers.length === 0
      }
    )

    if (this.availableFollowersPlaces.length) {
      this.goPlaceFollower()
    } else {
      this.endTurn()
    }
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
    if (
      !currentPlayer ||
      !this.playersFollowers[currentPlayer.id].ordinaryFollowers
    ) {
      this.endTurn()
    } else {
      this.currentTile = null
      this.isPlacingFollower = true
    }
  }

  placeFollower(availablePlace: AvailableFollowerPlace) {
    if (this.gameIsEnded) return
    const currentPlayer = this.currentPlayer
    if (!currentPlayer) return

    // Check if player has followers available
    if (!this.playersFollowers[currentPlayer.id]?.ordinaryFollowers) {
      this.skipFollower()
      return
    }

    this.playersFollowers[currentPlayer.id].ordinaryFollowers -= 1

    const temporaryObject = this.findObjectByPoint(
      this.temporaryObjects,
      availablePlace.point.x,
      availablePlace.point.y,
      availablePlace.point.direction
    )

    if (!temporaryObject) {
      this.skipFollower()
      return
    }

    temporaryObject.followers.push({
      playerId: currentPlayer.id,
      objectId: temporaryObject.id,
      point: availablePlace.point,
    })

    this.placedFollowers.push({
      playerId: currentPlayer.id,
      objectId: availablePlace.temporaryObject.id,
      point: availablePlace.point,
      isMonastery: availablePlace.temporaryObject.isMonastery,
    })

    this.availableFollowersPlaces = []

    this.actionsHistory.push({
      actionType: ActionTypes.PLACE_FOLLOWER,
      actionData: { ...availablePlace },
      initiator: currentPlayer,
    })

    this.endTurn()
  }

  skipFollower() {
    this.availableFollowersPlaces = []
    this.endTurn()
  }

  findObjectByPoint(
    objects: TemporaryObjects,
    x: number,
    y: number,
    direction?: SideName | 'center'
  ): BaseObject | undefined {
    return [...objects.cities, ...objects.roads, ...objects.monasteries].find(
      (object) => {
        return object.points.some((point) => {
          return (
            point.x === x &&
            point.y === y &&
            (!direction || point.direction === direction)
          )
        })
      }
    )
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
      const tilePlaced = this.placeTile(
        move.tile,
        move.rowIndex,
        move.tileIndex
      )
      if (!tilePlaced) return

      if (this.availableFollowersPlaces.length) {
        this.placeFollower(this.availableFollowersPlaces[0])
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

    const roadsPoints: Point[] = Object.entries(tile.sides)
      .filter(([, pointType]) => pointType === 'road')
      .map(([direction]) => {
        return {
          y: rowIndex,
          x: tileIndex,
          direction: direction as PointDirection,
          pointType: 'road',
        }
      })

    this.checkRoads(roadsPoints)

    const citiesPoints: Point[] = Object.entries(tile.sides)
      .filter(([, pointType]) => pointType === 'city')
      .map(([direction]) => {
        return {
          y: rowIndex,
          x: tileIndex,
          direction: direction as PointDirection,
          pointType: 'city',
        }
      })

    this.checkCities(citiesPoints, tile.isSolidCity)

    this.checkMonasteries(tile)
  }

  checkMonasteries(tile: GridTile) {
    if (tile.isMonastery) {
      this.temporaryObjects.monasteries.push({
        followers: [],
        id: 'id' + Math.random(),
        isMonastery: true,
        points: [{ x: tile.x, y: tile.y, rowIndex: tile.y, tileIndex: tile.x }],
      })
    }

    this.checkCompletedMonasteries()
  }

  checkCompletedMonasteries() {
    const surroundings: [number, number][] = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ]

    const completedMonasteries = this.temporaryObjects.monasteries.filter(
      (monastery) => {
        const monasteryPoint = monastery.points[0]
        if (!monasteryPoint) return false
        return surroundings.every(([dy, dx]) =>
          Boolean(
            this.tilePlacesStats[monasteryPoint.y + dy]?.[monasteryPoint.x + dx]
          )
        )
      }
    )

    this.temporaryObjects.monasteries =
      this.temporaryObjects.monasteries.filter(
        (monastery) => !completedMonasteries.find((m) => m.id === monastery.id)
      )

    this.completedObjects.monasteries = [
      ...this.completedObjects.monasteries,
      ...completedMonasteries,
    ]

    if (completedMonasteries.length) {
      this.calcScoreForMonasteries(completedMonasteries)
    }
  }

  calcScoreForMonasteries(monasteries: BaseObject[]) {
    monasteries.forEach((monastery) => {
      monastery.followers.forEach((follower) => {
        this.scores[follower.playerId] += 9

        this.actionsHistory.push({
          actionType: ActionTypes.ADDING_SCORES,
          actionData: {
            objectType: ObjectTypes.MONASTERY,
            objectData: monastery,
            score: {
              objectId: monastery.id,
              players: { [follower.playerId]: 9 },
              total: 9,
            },
          },
        })
        this.playersFollowers[follower.playerId].ordinaryFollowers += 1
        this.placedFollowers.splice(
          this.placedFollowers.findIndex(
            (f) =>
              f.playerId === follower.playerId && f.objectId === monastery.id
          ),
          1
        )
        this.actionsHistory.push({
          actionType: ActionTypes.BACK_FOLLOWER,
          actionData: { followers: [follower] },
        })
      })
    })
  }

  checkRoads(roadsPoints: Point[]) {
    if (roadsPoints.length === 2) {
      const roadsIds = roadsPoints
        .map((roadPoint) => {
          return this.temporaryObjects.roads.find((road) =>
            road.points.find((point) => this.isOppositePoint(point, roadPoint))
          )?.id
        })
        .filter((id): id is string => Boolean(id))

      if (roadsIds.length) {
        this.mergeRoads(roadsIds, roadsPoints)
      } else {
        this.temporaryObjects.roads.push({
          id: 'id' + Math.random(),
          points: roadsPoints,
          followers: [],
        })
      }
    } else {
      roadsPoints.forEach((roadPoint) => {
        const roadsIds = this.temporaryObjects.roads
          .filter((road) =>
            road.points.find((point) => this.isOppositePoint(point, roadPoint))
          )
          .map((road) => road.id)

        this.mergeRoads(roadsIds, [roadPoint])
      })
    }
  }

  mergeRoads(roadsIds: string[], roadsPoints: Point[]) {
    if (roadsIds.length === 1) {
      const road = this.temporaryObjects.roads.find((r) => r.id === roadsIds[0])
      if (!road) return

      road.points = road.points.concat(roadsPoints)

      this.checkCompleteRoad(road)
    } else {
      const mergingRoads = roadsIds
        .map((id) => this.temporaryObjects.roads.find((r) => r.id === id))
        .filter((r): r is BaseObject => Boolean(r))

      const road: BaseObject = {
        id: 'id' + Math.random(),
        points: mergingRoads.flatMap((r) => r.points).concat(roadsPoints),
        followers: mergingRoads.flatMap((r) => r.followers),
      }

      roadsIds.forEach((id) => {
        this.temporaryObjects.roads = this.temporaryObjects.roads.filter(
          (r) => r.id !== id
        )
      })

      this.temporaryObjects.roads.push(road)

      this.checkCompleteRoad(road)
    }
  }

  checkCompleteRoad(road: BaseObject) {
    const isAllPointsCompleted = road.points.every((point) => {
      const pointPrecisionCoordinates = this.getPrecisionCoordinates(point)
      return road.points.some((otherPoint) => {
        const otherPointPrecisionCoordinates =
          this.getPrecisionCoordinates(otherPoint)
        return (
          pointPrecisionCoordinates.x === otherPointPrecisionCoordinates.x &&
          pointPrecisionCoordinates.y === otherPointPrecisionCoordinates.y &&
          point.direction !== otherPoint.direction
        )
      })
    })

    if (!isAllPointsCompleted) return

    const score = this.calcScoreForRoad(road)
    this.temporaryObjects.roads = this.temporaryObjects.roads.filter(
      (r) => r.id !== road.id
    )
    this.completedObjects.roads.push({ ...deepClone(road), score })

    if (road.followers.length) {
      this.actionsHistory.push({
        actionType: ActionTypes.ADDING_SCORES,
        actionData: {
          objectType: ObjectTypes.ROAD,
          objectData: road,
          score,
        },
      })
    }

    road.followers.forEach((follower) => {
      this.playersFollowers[follower.playerId].ordinaryFollowers += 1
      this.placedFollowers.splice(
        this.placedFollowers.findIndex(
          (f) => f.playerId === follower.playerId && f.objectId === road.id
        ),
        1
      )
    })

    if (road.followers.length) {
      this.actionsHistory.push({
        actionType: ActionTypes.BACK_FOLLOWER,
        actionData: { followers: road.followers },
      })
    }
  }

  recalculateScores() {
    Object.keys(this.scores).forEach((playerId) => {
      this.scores[playerId] = 0
    })

    this.completedObjects.roads.forEach((road) => {
      road.score = this.calcScoreForRoad(road)
    })

    this.completedObjects.cities.forEach((city) => {
      city.score = this.calcScoreForCity(city)
    })
  }

  calcScoreForRoad(road: BaseObject, _isCompleted = true): ScoreForObject {
    return calcRoadScore(this.tilePlacesStats, road, this.scores)
  }

  checkCities(citiesPoints: Point[], isSolidCity?: boolean) {
    if (isSolidCity) {
      const citiesIds = citiesPoints
        .map((cityPoint) => {
          return this.temporaryObjects.cities.find((city) =>
            city.points.find((point) => this.isOppositePoint(point, cityPoint))
          )?.id
        })
        .filter((id): id is string => Boolean(id))

      if (citiesIds.length) {
        this.mergeCities(citiesIds, citiesPoints)
      } else {
        this.temporaryObjects.cities.push({
          id: 'id' + Math.random(),
          points: citiesPoints,
          followers: [],
        })
      }
    } else {
      citiesPoints.forEach((cityPoint) => {
        const citiesIds = this.temporaryObjects.cities
          .filter((city) =>
            city.points.find((point) => this.isOppositePoint(point, cityPoint))
          )
          .map((city) => city.id)

        this.mergeCities(citiesIds, [cityPoint])
      })
    }
  }

  mergeCities(citiesIds: string[], citiesPoints: Point[]) {
    if (citiesIds.length === 1) {
      const city = this.temporaryObjects.cities.find(
        (c) => c.id === citiesIds[0]
      )
      if (!city) return

      city.points = city.points.concat(citiesPoints)

      this.checkCompleteCity(city)
    } else {
      const mergingCities = citiesIds
        .map((id) => this.temporaryObjects.cities.find((c) => c.id === id))
        .filter((c): c is BaseObject => Boolean(c))

      const city: BaseObject = {
        id: 'id' + Math.random(),
        points: mergingCities.flatMap((c) => c.points).concat(citiesPoints),
        followers: mergingCities.flatMap((c) => c.followers),
      }

      citiesIds.forEach((id) => {
        this.temporaryObjects.cities = this.temporaryObjects.cities.filter(
          (c) => c.id !== id
        )
      })

      this.temporaryObjects.cities.push(city)

      this.checkCompleteCity(city)
    }
  }

  checkCompleteCity(city: BaseObject) {
    const isAllPointsCompleted = city.points.every((point) => {
      const pointPrecisionCoordinates = this.getPrecisionCoordinates(point)
      return city.points.some((otherPoint) => {
        const otherPointPrecisionCoordinates =
          this.getPrecisionCoordinates(otherPoint)
        return (
          pointPrecisionCoordinates.x === otherPointPrecisionCoordinates.x &&
          pointPrecisionCoordinates.y === otherPointPrecisionCoordinates.y &&
          point.direction !== otherPoint.direction
        )
      })
    })

    if (!isAllPointsCompleted) return

    const score = this.calcScoreForCity(city)
    this.temporaryObjects.cities = this.temporaryObjects.cities.filter(
      (c) => c.id !== city.id
    )
    this.completedObjects.cities.push({ ...deepClone(city), score })

    if (city.followers.length) {
      this.actionsHistory.push({
        actionType: ActionTypes.ADDING_SCORES,
        actionData: {
          objectType: ObjectTypes.CITY,
          objectData: city,
          score,
        },
      })
    }

    city.followers.forEach((follower) => {
      this.playersFollowers[follower.playerId].ordinaryFollowers += 1
      this.placedFollowers.splice(
        this.placedFollowers.findIndex(
          (f) => f.playerId === follower.playerId && f.objectId === city.id
        ),
        1
      )
    })

    if (city.followers.length) {
      this.actionsHistory.push({
        actionType: ActionTypes.BACK_FOLLOWER,
        actionData: { followers: city.followers },
      })
    }
  }

  calcScoreForCity(city: BaseObject, _isCompleted = true): ScoreForObject {
    return calcCityScore(this.tilePlacesStats, city, this.scores)
  }

  getCompletedObjectsForPlayer(
    objectType: keyof CompletedObjects,
    _playerId: PlayerId
  ) {
    return this.completedObjects[objectType].filter((object) => object.score)
  }

  isCorrectTilePosition(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): boolean {
    if (this.isEmptyGrid()) return true
    if (this.tilePlacesStats[rowIndex]?.[tileIndex]) {
      return false
    } else {
      const adjacentTiles = [
        this.tilePlacesStats[rowIndex - 1]?.[tileIndex]?.sides?.south,
        this.tilePlacesStats[rowIndex]?.[tileIndex + 1]?.sides?.west,
        this.tilePlacesStats[rowIndex + 1]?.[tileIndex]?.sides?.north,
        this.tilePlacesStats[rowIndex]?.[tileIndex - 1]?.sides?.east,
      ]

      if (adjacentTiles.some((pointType) => Boolean(pointType))) {
        const sides = Object.keys(tile.sides) as SideName[]
        return adjacentTiles.every(
          (adjacentPointType, index) =>
            !adjacentPointType || adjacentPointType === tile.sides[sides[index]]
        )
      } else {
        return false
      }
    }
  }

  isOppositePoint(point: Point, oppositePoint: Point): boolean {
    const pointPrecisionCoordinates = this.getPrecisionCoordinates(point)
    const oppositePointPrecisionCoordinates =
      this.getPrecisionCoordinates(oppositePoint)

    return (
      pointPrecisionCoordinates.x === oppositePointPrecisionCoordinates.x &&
      pointPrecisionCoordinates.y === oppositePointPrecisionCoordinates.y
    )
  }

  getPrecisionCoordinates(point: Point): { x: number; y: number } {
    let x = point.x
    let y = point.y

    if (point.direction === 'north') {
      y -= 0.5
    } else if (point.direction === 'south') {
      y += 0.5
    } else if (point.direction === 'east') {
      x += 0.5
    } else if (point.direction === 'west') {
      x -= 0.5
    }

    return { x, y }
  }

  rotateTile(tile: Tile, direction: RotationDirection = 'clockwise'): Tile {
    const processedTile = { ...tile }
    if (direction === 'clockwise') {
      if (processedTile.rotation + 90 > 360) {
        processedTile.rotation = 0
      }
      processedTile.rotation += 90

      processedTile.sides = {
        ...processedTile.sides,
        north: processedTile.sides.west,
        west: processedTile.sides.south,
        south: processedTile.sides.east,
        east: processedTile.sides.north,
      }
    } else {
      if (processedTile.rotation - 90 < 0) {
        processedTile.rotation = 360
      }
      processedTile.rotation -= 90

      processedTile.sides = {
        ...processedTile.sides,
        north: processedTile.sides.east,
        west: processedTile.sides.north,
        south: processedTile.sides.west,
        east: processedTile.sides.south,
      }
    }

    return processedTile
  }

  async autoPlay(): Promise<void> {
    while (this.tilesList.length > 0) {
      await this.autoPlaceTile()

      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    console.log('Игра завершена!')
  }

  isEmptyGrid(): boolean {
    return this.lastPlacement.rowIndex === undefined
  }

  clone(): IGameBoard {
    const clone = new GameManager({ players: this.players })

    clone.gridSize = [...this.gridSize]
    clone.gameIsStarted = this.gameIsStarted
    clone.gameIsEnded = this.gameIsEnded
    clone.isPlacingFollower = this.isPlacingFollower

    clone.availablePlacesTiles = deepClone(this.availablePlacesTiles)
    clone.tilesList = deepClone(this.tilesList)
    clone.currentTile = this.currentTile ? deepClone(this.currentTile) : null
    clone.players = deepClone(this.players)
    clone.currentPlayer = this.currentPlayer
      ? deepClone(this.currentPlayer)
      : null
    clone.playersFollowers = deepClone(this.playersFollowers)
    clone.temporaryObjects = deepClone(this.temporaryObjects)
    clone.completedObjects = deepClone(this.completedObjects)
    clone.scores = deepClone(this.scores)
    clone.availableFollowersPlaces = deepClone(this.availableFollowersPlaces)
    clone.placedFollowers = deepClone(this.placedFollowers)
    clone.lastPlacement = deepClone(this.lastPlacement)
    clone.tileHistory = deepClone(this.tileHistory)
    clone.tilePlacesStats = deepClone(this.tilePlacesStats)
    clone.lastUpdate = this.lastUpdate

    return clone
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
    return true
  }

  simulatePlaceFollower(availablePlace: AvailableFollowerPlace): boolean {
    const currentPlayer = this.currentPlayer
    if (
      !currentPlayer ||
      !this.playersFollowers[currentPlayer.id]?.ordinaryFollowers
    ) {
      return false
    }

    this.playersFollowers[currentPlayer.id].ordinaryFollowers -= 1
    availablePlace.temporaryObject.followers.push({
      playerId: currentPlayer.id,
      objectId: availablePlace.temporaryObject.id,
      point: availablePlace.point,
    })

    this.placedFollowers.push({
      playerId: currentPlayer.id,
      objectId: availablePlace.temporaryObject.id,
      point: availablePlace.point,
    })

    return true
  }
}

export default GameManager
