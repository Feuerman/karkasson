// @ts-nocheck
// @ts-ignore

import tiles from '../data/tiles.ts'
import { deepClone } from '../utils/common.ts'
import { GameSimulatorModule } from './GameSimulatorModule'
import type {
  BaseObject,
  Player,
  Point,
  Scores,
  FollowerCount,
} from './types.ts'

interface Tile {
  id: string
  imgUrl: string
  rotation: number
  sides: {
    north: string
    west: string
    south: string
    east: string
  }
}

interface GridTile extends Tile {
  x: number
  y: number
  withShield?: boolean
  isSolidCity?: boolean
  precisionX?: number
  precisionY?: number
}

export enum ActionTypes {
  PLACE_TILE = 'PLACE_TILE',
  PLACE_FOLLOWER = 'PLACE_FOLLOWER',
  ADDING_SCORES = 'ADDING_SCORES',
  BACK_FOLLOWER = 'BACK_FOLLOWER',
}

export enum ObjectTypes {
  CITY = 'CITY',
  ROAD = 'ROAD',
  MONASTERY = 'MONASTERY',
}

export interface IGameBoard {
  gridSize: number[]
  gameIsStarted: boolean
  gameIsEnded: boolean
  tilesList: Tile[]
  currentTile: GridTile | null // Changed from 'any' to 'Tile'
  players: Player[]
  currentPlayer: Player | null // Assuming Player has an 'id' property
  currentPlayerIndex: number
  playersFollowers: { [playerId: Player['id']]: FollowerCount }
  temporaryObjects: TemporaryObjects
  completedObjects: CompletedObjects // This type is still unclear, please provide more information
  scores: Scores // This type is still unclear, please provide more information
  availableFollowersPlaces: { point: Point; temporaryObject: BaseObject }[]
  isPlacingFollower: boolean
  availablePlacesTiles: { rowIndex: number; tileIndex: number }[]
  lastPlacement: { rowIndex: number; tileIndex: number } | null
  tileHistory: Tile[]
  actionsHistory: {
    actionType: ActionTypes
    actionData: any
    initiator?: Player | null
  }[]
  moveCounter: number
  startGame(): void
  autoPlay(): void
  placeFollower(availablePlace: {
    point: Point
    temporaryObject: BaseObject
  }): void
  skipFollower(): void
  placeTile(tile: Tile, rowIndex: number, tileIndex: number): void
  autoPlaceTile(): void
  calcScoreForCity(city: BaseObject): {
    total: number
    players: { [playerId: Player['id']]: number }
  }
  calcScoreForRoad(road: BaseObject): {
    total: number
    players: { [playerId: Player['id']]: number }
  }
  zoomToObject(objectId: string): void
  recalculateScores(): void
  clone(): IGameBoard
  simulatePlaceTile(tile: Tile, rowIndex: number, tileIndex: number): boolean
  simulatePlaceFollower({
    point,
    temporaryObject,
  }: {
    point: Point
    temporaryObject: BaseObject
  }): boolean
  getNextPlayer(currentPlayerId: Player['id']): Player
}

interface TemporaryObjects {
  cities: BaseObject[]
  roads: BaseObject[]
  monasteries: BaseObject[]
}

interface CompletedObjects {
  cities: BaseObject[]
  roads: BaseObject[]
  monasteries: BaseObject[]
}

export class GameManager implements IGameBoard {
  gridSize = [30, 30]
  gameIsStarted: boolean
  gameIsEnded: boolean
  tilesList: Tile[]
  currentTile: GridTile | null
  players: Player[]
  currentPlayer: Player | null
  currentPlayerIndex: number
  playersFollowers: { [playerId: Player['id']]: FollowerCount }
  temporaryObjects: TemporaryObjects
  completedObjects: CompletedObjects
  scores: Scores
  availableFollowersPlaces: { point: Point; temporaryObject: BaseObject }[]
  isPlacingFollower: boolean
  placedFollowers: { playerId: Player['id']; objectId: string; point: Point }[]
  tilePlacesStats: {
    [key: string]: {
      rowIndex: number
      tileIndex: number
      rotation: number
      sides: {
        north: string
        west: string
        south: string
        east: string
      }
    }[]
  } = {}
  lastPlacement: { rowIndex: number; tileIndex: number }
  availablePlacesTiles: {
    rowIndex: number
    tileIndex: number
    objects: BaseObject[]
  }[]
  tileHistory: Tile[]
  moveCounter: number
  actionsHistory: {
    actionType: ActionTypes
    actionData: any
    initiator?: Player | null
  }[]

  constructor(params?: Partial<{ players: any[] }>) {
    const players = params?.players || []
    this.gameIsStarted = false
    this.gameIsEnded = false
    this.tilesList = []
    this.currentTile = null
    this.players = []
    this.currentPlayer = null
    this.availableFollowersPlaces = []
    this.isPlacingFollower = false
    this.temporaryObjects = {
      cities: [],
      roads: [],
      monasteries: [],
    }
    this.completedObjects = {
      cities: [],
      roads: [],
      monasteries: [],
    }
    this.scores = {}
    this.playersFollowers = {}
    this.placedFollowers = []

    this.moveCounter = 1
    this.lastPlacement = {
      rowIndex: undefined,
      tileIndex: undefined,
    }
    this.availablePlacesTiles = []
    this.tileHistory = []

    this.actionsHistory = []

    // this.initGrid()
    this.initTilesList()
    this.initPlayers(players)

    this.startGame()
  }

  initGrid() {
    for (let i = 0; i < this.gridSize[1]; i++) {
      this.grid[i] = []
      for (let j = 0; j < this.gridSize[0]; j++) {
        this.grid[i][j] = null
      }
    }
  }

  initTilesList() {
    this.tilesList = tiles
      .reduce((acc, tile) => {
        return [...acc, ...Array(tile.count).fill({ ...tile, rotation: 0 })]
      }, [])
      .sort(() => Math.random() - 0.5)
  }

  initPlayers(players) {
    players.forEach((player) => {
      this.players.push(player)
      this.scores[player.id] = 0
    })

    this.playersFollowers = this.players.reduce((acc, player) => {
      acc[player.id] = { ordinaryFollowers: 7, monks: 1 }
      return acc
    }, {})
  }

  startGame() {
    this.gameIsStarted = true

    this.placeStartTile()

    this.currentPlayer = this.players[0]
    this.currentPlayerIndex = 0
  }

  zoomToObject(objectId: string) {
    const object = [
      ...this.temporaryObjects.cities,
      ...this.temporaryObjects.roads,
      ...this.temporaryObjects.monasteries,
      ...this.completedObjects.cities,
      ...this.completedObjects.roads,
      ...this.completedObjects.monasteries,
    ].find((object) => object.id === objectId)
    const point = object?.points[0]
    const rowIndex = point?.y
    const tileIndex = point?.x

    if (rowIndex && tileIndex) {
      const targetTile = document.querySelector(
        '.game-tile[data-row-index="' +
          rowIndex +
          '"][data-tile-index="' +
          tileIndex +
          '"]'
      )

      if (targetTile) {
        targetTile?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        })
      }
    }
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
    if (
      this.players.findIndex(
        (player) => player.id === this.currentPlayer?.id
      ) ===
      this.players.length - 1
    ) {
      this.moveCounter = this.moveCounter + 1
    }
    this.isPlacingFollower = false

    const nextPlayer = this.getNextPlayer(this.currentPlayer?.id)

    this.currentPlayer = nextPlayer
    this.currentPlayerIndex = this.players.findIndex(
      (player) => player.id === nextPlayer.id
    )

    this.getRandomTileFromList()
  }

  getNextPlayer(currentPlayerId) {
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

    if (!this.playersFollowers[this.currentPlayer.id].ordinaryFollowers) {
      this.endTurn()
      return
    }
    this.availableFollowersPlaces = Object.keys(this.currentTile?.sides)
      .map((side) => {
        return {
          point: {
            x: this.currentTile.x,
            y: this.currentTile.y,
            direction: side,
            pointType: this.currentTile.sides[side],
          },
          temporaryObject: this.findObjectByPoint(
            this.temporaryObjects,
            this.currentTile.x,
            this.currentTile.y,
            side
          ),
        }
      })
      .filter((place) => {
        return (
          place.temporaryObject &&
          (!place.temporaryObject.followers?.length ||
            !place.temporaryObject.followers.find(
              (follower) => follower.playerId !== this.currentPlayer.id
            ))
        )
      })

    if (this.availableFollowersPlaces.length) {
      this.goPlaceFollower()
    } else {
      this.endTurn()
    }
  }

  placeTile(tile, rowIndex, tileIndex) {
    if (this.gameIsEnded) return

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
    this.tilePlacesStats[rowIndex][tileIndex] = { ...tile, rowIndex, tileIndex, x: tileIndex, y: rowIndex }
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

  setAvailablePlacesTiles({ rowIndex, tileIndex }) {
    const oppositeTilesCoords = [
      {
        rowIndex: rowIndex - 1,
        tileIndex,
      },
      {
        rowIndex,
        tileIndex: tileIndex + 1,
      },
      {
        rowIndex: rowIndex + 1,
        tileIndex,
      },
      {
        rowIndex,
        tileIndex: tileIndex - 1,
      },
    ]

    oppositeTilesCoords.forEach((tile) => {
      if (
        !this.tilePlacesStats[tile.rowIndex]?.[tile.tileIndex] &&
        !this.availablePlacesTiles.find(
          (place) =>
            place.rowIndex === tile.rowIndex &&
            place.tileIndex === tile.tileIndex
        )
      ) {
        this.availablePlacesTiles.push({
          ...tile,
          objects: ['north', 'east', 'south', 'west'].map((side) => {
            const adjacentTileMap = {
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

            const adjacentTile =
              this.tilePlacesStats[adjacentTileMap[side].rowIndex]?.[
                adjacentTileMap[side].tileIndex
              ]

            if (!adjacentTile) return null
            return this.findObjectByPoint(
              this.temporaryObjects,
              adjacentTileMap[side].tileIndex,
              adjacentTileMap[side].rowIndex,
              adjacentTileMap[side].side
            )
          }),
        })
      }
    })

    this.availablePlacesTiles = this.availablePlacesTiles.filter((place) => {
      return place.rowIndex !== rowIndex || place.tileIndex !== tileIndex
    })
  }

  goPlaceFollower() {
    if (!this.playersFollowers[this.currentPlayer.id].ordinaryFollowers) {
      this.endTurn()
    } else {
      this.currentTile = null
      this.isPlacingFollower = true
    }
  }

  placeFollower(availablePlace) {
    if (this.gameIsEnded) return

    // Check if player has followers available
    if (!this.playersFollowers[this.currentPlayer.id]?.ordinaryFollowers) {
      this.skipFollower()
      return
    }

    this.playersFollowers[this.currentPlayer.id].ordinaryFollowers -= 1

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

    temporaryObject?.followers?.push({
      playerId: this.currentPlayer.id,
      objectId: temporaryObject.id,
      point: availablePlace.point,
    })

    this.placedFollowers.push({
      playerId: this.currentPlayer.id,
      objectId: availablePlace.temporaryObject.id,
      point: availablePlace.point,
    })

    this.availableFollowersPlaces = []

    this.actionsHistory.push({
      actionType: ActionTypes.PLACE_FOLLOWER,
      actionData: { ...availablePlace },
      initiator: this.currentPlayer,
    })

    this.endTurn()
  }

  skipFollower() {
    this.availableFollowersPlaces = []
    this.endTurn()
  }

  findObjectByPoint(objects, x, y, direction) {
    return [...objects.cities, ...objects.roads].find((object) => {
      return object.points.some((point) => {
        return point.x === x && point.y === y && point.direction === direction
      })
    })
  }

  async autoPlaceTile() {
    if (this.gameIsEnded) {
      return
    }

    // Ensure we have a current tile
    if (!this.currentTile) {
      this.getRandomTileFromList()
      if (!this.currentTile) {
        return
      }
    }

    try {
      const simulator = new GameSimulatorModule(this)
      const result = simulator.findBestMove(this.currentTile)

      if (result.moves.length) {
        const move = result.moves[0]
        if (move) {
          // Place the tile
          const tilePlaced = this.placeTile(
            move.tile,
            move.rowIndex,
            move.tileIndex
          )
          if (!tilePlaced) {
            return
          }

          // Handle follower placement if available
          if (this.availableFollowersPlaces.length) {
            this.placeFollower(this.availableFollowersPlaces[0])
          } else {
            // this.skipFollower()
          }
        }
      } else {
        // If no valid moves found, get a new tile and try again
        this.getRandomTileFromList()
        if (this.currentTile) {
          await this.autoPlaceTile()
        }
      }
    } catch (error) {
      throw error
    }
  }

  getRandomTileFromList() {
    if (!this.tilesList.length) {
      this.gameIsEnded = true
    } else {
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
  }

  checkAvailablePlacesForTile(tile) {
    return this.availablePlacesTiles.some((place) => {
      return [0, 1, 2, 3].some((rotationCount) => {
        let processedTile = { ...tile }
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

  updateTileHistory(tile) {
    this.tileHistory.push(deepClone(tile))
  }

  checkGridAfterPlacingTile(rowIndex, tileIndex) {
    const tile = this.tilePlacesStats[rowIndex][tileIndex]

    const roadsPoints = Object.entries(tile.sides)
      .filter(([direction, pointType]) => pointType === 'road')
      .map(([direction, pointType]) => {
        return {
          y: rowIndex,
          x: tileIndex,
          direction,
          pointType,
        }
      })

    this.checkRoads(roadsPoints)

    const citiesPoints = Object.entries(tile.sides)
      .filter(([direction, pointType]) => pointType === 'city')
      .map(([direction, pointType]) => {
        return {
          y: rowIndex,
          x: tileIndex,
          direction,
          pointType,
        }
      })

    this.checkCities(citiesPoints, tile.isSolidCity)
  }

  checkRoads(roadsPoints) {
    if (roadsPoints.length === 2) {
      const roadsIds = roadsPoints
        .map((roadPoint) => {
          return this.temporaryObjects.roads.find((road) =>
            road.points.find((point) => this.isOppositePoint(point, roadPoint))
          )?.id
        })
        .filter((id) => id)

      if (roadsIds.length) {
        this.mergeRoads(roadsIds, roadsPoints)
      } else {
        const tempRoad = {
          id: 'id' + Math.random(),
          points: roadsPoints,
          followers: [],
        }
        this.temporaryObjects.roads.push({
          ...tempRoad,
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

  mergeRoads(roadsIds, roadsPoints) {
    if (roadsIds.length === 1) {
      const road = this.temporaryObjects.roads.find(
        (road) => road.id === roadsIds[0]
      )

      road.points = road.points.concat(roadsPoints)

      this.checkCompleteRoad(road)
    } else {
      const road = {
        id: 'id' + Math.random(),
        points: roadsIds
          .map((id) => {
            return this.temporaryObjects.roads.find((road) => road.id === id)
              .points
          })
          .flat()
          .concat(roadsPoints),
        followers: roadsIds
          .map((id) => {
            return this.temporaryObjects.roads.find((road) => road.id === id)
              .followers
          })
          .flat(),
      }

      roadsIds.forEach((id) => {
        this.temporaryObjects.roads = this.temporaryObjects.roads.filter(
          (road) => road.id !== id
        )
      })

      this.temporaryObjects.roads.push({
        ...road,
      })

      this.checkCompleteRoad(road)
    }
  }

  checkCompleteRoad(road) {
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

    if (isAllPointsCompleted) {
      const score = this.calcScoreForRoad(road)
      this.temporaryObjects.roads = this.temporaryObjects.roads.filter(
        (r) => r.id !== road.id
      )
      this.completedObjects.roads.push({
        ...JSON.parse(JSON.stringify(road)),
        score,
      })

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
          actionData: {
            followers: road.followers,
          },
        })
      }
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

  calcScoreForRoad(road, isCompleted = true) {
    let points: number = 0
    const uniqueTiles = new Set()

    road.points.forEach((point) => {
      const tile = this.tilePlacesStats[point.y]?.[point.x]
      if (tile) {
        uniqueTiles.add(`${point.y},${point.x}`)
      }
    })

    points = uniqueTiles.size

    if (road.followers.length) {
      points = uniqueTiles.size

      const uniqueFollowers: Set<string> = new Set(
        road.followers.map((follower) => follower.playerId)
      )
      const followersCount: number = uniqueFollowers.size
      const isOnePlayer = followersCount === 1
      const scores = Array.from(uniqueFollowers).reduce((acc, followerId) => {
        acc[followerId] = isOnePlayer
          ? points
          : Math.ceil(points / followersCount)
        if (isCompleted) {
          this.scores[followerId] += isOnePlayer
            ? points
            : Math.ceil(points / followersCount)
        }
        return acc
      }, {})

      return {
        total: isOnePlayer
          ? points
          : Math.ceil(points / followersCount) * followersCount,
        players: scores,
        objectId: road.id,
      }
    } else {
      points = uniqueTiles.size

      return {
        total: points,
        players: {},
      }
    }
  }

  checkCities(citiesPoints, isSolidCity) {
    if (isSolidCity) {
      const citiesIds = citiesPoints
        .map((cityPoint) => {
          return this.temporaryObjects.cities.find((road) =>
            road.points.find((point) => this.isOppositePoint(point, cityPoint))
          )?.id
        })
        .filter((id) => id)

      if (citiesIds.length) {
        this.mergeCities(citiesIds, citiesPoints)
      } else {
        const tempCity = {
          id: 'id' + Math.random(),
          points: citiesPoints,
          followers: [],
        }
        this.temporaryObjects.cities.push({
          ...tempCity,
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

  mergeCities(citiesIds, citiesPoints) {
    if (citiesIds.length === 1) {
      const city = this.temporaryObjects.cities.find(
        (city) => city.id === citiesIds[0]
      )

      city.points = city.points.concat(citiesPoints)

      this.checkCompleteCity(city)
    } else {
      const city = {
        id: 'id' + Math.random(),
        points: citiesIds
          .map((id) => {
            return this.temporaryObjects.cities.find((city) => city.id === id)
              .points
          })
          .flat()
          .concat(citiesPoints),
        followers: citiesIds
          .map((id) => {
            return this.temporaryObjects.cities.find((road) => road.id === id)
              .followers
          })
          .flat(),
      }

      citiesIds.forEach((id) => {
        this.temporaryObjects.cities = this.temporaryObjects.cities.filter(
          (city) => city.id !== id
        )
      })

      this.temporaryObjects.cities.push({
        ...city,
      })

      this.checkCompleteCity(city)
    }
  }

  checkCompleteCity(city) {
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

    if (isAllPointsCompleted) {
      const score = this.calcScoreForCity(city)
      this.temporaryObjects.cities = this.temporaryObjects.cities.filter(
        (r) => r.id !== city.id
      )
      this.completedObjects.cities.push({
        ...JSON.parse(JSON.stringify(city)),
        score,
      })

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
          actionData: {
            followers: city.followers,
          },
        })
      }
    }
  }

  calcScoreForCity(city, isCompleted = true) {
    let points: number = 0
    const uniqueTiles = new Set()
    let shieldCount = 0

    city.points.forEach((point) => {
      const tile = this.tilePlacesStats[point.y]?.[point.x]
      if (tile && !uniqueTiles.has(`${point.y},${point.x}`)) {
        uniqueTiles.add(`${point.y},${point.x}`)
        if (tile.withShield) {
          shieldCount++
        }
      }
    })

    if (city.followers.length) {
      points = uniqueTiles.size * 2
      points += shieldCount * 2

      const followersCountByPlayer: Record<string, number> =
        city.followers.reduce((acc, follower) => {
          acc[follower.playerId] = acc[follower.playerId]
            ? acc[follower.playerId] + 1
            : 1
          return acc
        }, {})
      const isOnePlayer = Object.keys(followersCountByPlayer).length === 1

      const followersCount: number = Object.values(
        followersCountByPlayer
      ).reduce((acc, count) => acc + count, 0)
      const scores = Object.entries(followersCountByPlayer).reduce(
        (acc, [playerId, count]: [string, number]) => {
          acc[playerId] = isOnePlayer
            ? points
            : Math.ceil(points / followersCount) * count
          if (isCompleted) {
            this.scores[playerId] += isOnePlayer
              ? points
              : Math.ceil(points / followersCount) * count
          }
          return acc
        },
        {}
      )

      return {
        total: isOnePlayer
          ? points
          : Math.ceil(points / followersCount) * followersCount,
        players: scores,
        objectId: city.id,
      }
    } else {
      points = uniqueTiles.size * 2
      points += shieldCount * 2
      return {
        total: points,
        players: {},
      }
    }
  }

  getCompletedObjectsForPlayer(objectType, playerId) {
    return this.completedObjects[objectType].filter((object) => object.score)
  }

  isCorrectTilePosition(tile, rowIndex, tileIndex) {
    if (this.isEmptyGrid()) return true
    if (Boolean(this.tilePlacesStats[rowIndex]?.[tileIndex])) {
      return false
    } else {
      const adjacentTiles = [
        this.tilePlacesStats[rowIndex - 1]?.[tileIndex]?.sides?.south,
        this.tilePlacesStats[rowIndex]?.[tileIndex + 1]?.sides?.west,
        this.tilePlacesStats[rowIndex + 1]?.[tileIndex]?.sides?.north,
        this.tilePlacesStats[rowIndex]?.[tileIndex - 1]?.sides?.east,
      ]

      if (adjacentTiles.some((pointType) => Boolean(pointType))) {
        return adjacentTiles.every(
          (adjacentPointType, index) =>
            !adjacentPointType ||
            adjacentPointType === tile.sides[Object.keys(tile.sides)[index]]
        )
      } else {
        return false
      }
    }
  }

  isOppositePoint(point, oppositePoint) {
    const pointPrecisionCoordinates = this.getPrecisionCoordinates(point)
    const oppositePointPrecisionCoordinates =
      this.getPrecisionCoordinates(oppositePoint)

    return (
      pointPrecisionCoordinates.x === oppositePointPrecisionCoordinates.x &&
      pointPrecisionCoordinates.y === oppositePointPrecisionCoordinates.y
    )
  }

  getPrecisionCoordinates(point) {
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

  rotateTile(tile, direction = 'clockwise') {
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

  async autoPlay() {
    while (this.tilesList.length > 0) {
      await this.autoPlaceTile()

      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    console.log('Игра завершена!')
    console.log('Результаты:')
    // window.location.reload();
  }

  isEmptyGrid() {
    return this.lastPlacement.rowIndex === undefined
  }

  clone(): IGameBoard {
    const clone = new GameManager({ players: this.players })

    // Copy primitive properties
    clone.gridSize = [...this.gridSize]
    clone.gameIsStarted = this.gameIsStarted
    clone.gameIsEnded = this.gameIsEnded
    clone.isPlacingFollower = this.isPlacingFollower

    clone.availablePlacesTiles = deepClone(this.availablePlacesTiles)

    // Deep copy tiles list
    clone.tilesList = deepClone(this.tilesList)

    // Copy current tile
    clone.currentTile = this.currentTile
      ? { ...deepClone(this.currentTile) }
      : null

    // Deep copy players
    clone.players = deepClone(this.players)
    clone.currentPlayer = this.currentPlayer
      ? { ...deepClone(this.currentPlayer) }
      : null

    // Deep copy followers
    clone.playersFollowers = deepClone(this.playersFollowers)

    // Deep copy temporary objects
    clone.temporaryObjects = deepClone(this.temporaryObjects)

    // Deep copy completed objects
    clone.completedObjects = deepClone(this.completedObjects)

    // Deep copy scores
    clone.scores = {
      ...deepClone(this.scores),
    }

    // Deep copy available followers places
    clone.availableFollowersPlaces = deepClone(this.availableFollowersPlaces)

    // Deep copy placed followers
    clone.placedFollowers = deepClone(this.placedFollowers)

    // Deep copy last placement
    clone.lastPlacement = deepClone(this.lastPlacement)

    // Deep copy last follower placement
    clone.tileHistory = deepClone(this.tileHistory)

    clone.tilePlacesStats = deepClone(this.tilePlacesStats)

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

    // Create a copy of the tile with position
    const placedTile = { ...tile, x: tileIndex, y: rowIndex }

    if (!this.tilePlacesStats[rowIndex]) {
      this.tilePlacesStats[rowIndex] = {}
    }
    this.tilePlacesStats[rowIndex][tileIndex] = placedTile

    // Check for completed objects
    this.checkGridAfterPlacingTile(rowIndex, tileIndex)
    return true
  }

  simulatePlaceFollower(availablePlace: {
    point: Point
    temporaryObject: BaseObject
  }): boolean {
    if (
      !this.currentPlayer ||
      !this.playersFollowers[this.currentPlayer.id]?.ordinaryFollowers
    ) {
      return false
    }

    this.playersFollowers[this.currentPlayer.id].ordinaryFollowers -= 1
    availablePlace.temporaryObject.followers.push({
      playerId: this.currentPlayer.id,
      objectId: availablePlace.temporaryObject.id,
      point: availablePlace.point,
    })

    this.placedFollowers.push({
      playerId: this.currentPlayer.id,
      objectId: availablePlace.temporaryObject.id,
      point: availablePlace.point,
    })

    return true
  }
}

export default GameManager
