import type { GameAction, NewGameAction } from './GameManager'
import { deepClone } from '../utils/common'
import { describeCompletedCentralObject } from './scoring'
import {
  ActionTypes,
  ObjectTypes,
  ExpansionName,
  PointDirection,
  SIDE_NAMES,
  TileSideType,
  type BaseObject,
  type FollowerCount,
  type ObjectFollower,
  type PlacedFollower,
  type Point,
  type ScoreDetails,
  type ScoreForObject,
  type Scores,
  type TemporaryObjects,
  type CompletedObjects,
  type TilePlacesStats,
  type GridTile,
  type SideName,
  type PlayerId,
} from './types'

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

interface GameObjectState {
  temporaryObjects: TemporaryObjects
  completedObjects: CompletedObjects
  tilePlacesStats: TilePlacesStats
  scores: Scores
  playersFollowers: Record<PlayerId, FollowerCount>
  placedFollowers: PlacedFollower[]
  actionsHistory: GameAction[]
  recordAction(action: NewGameAction): void
  getTileFeatureGroups(tile: GridTile, feature: LinearFeatureKind): SideName[][]
  getPrecisionCoordinates(point: Point): { x: number; y: number }
  isOppositePoint(point: Point, oppositePoint: Point): boolean
  calcScoreForRoad(road: BaseObject, isCompleted?: boolean): ScoreForObject
  calcScoreForCity(city: BaseObject, isCompleted?: boolean): ScoreForObject
  describeScoreForRoad(road: BaseObject, isCompleted?: boolean): ScoreDetails
  describeScoreForCity(city: BaseObject, isCompleted?: boolean): ScoreDetails
}

/** Owns feature-object discovery, merging, completion and follower return. */
export class GameObjectManager {
  constructor(private readonly state: GameObjectState) {}

  checkGridAfterPlacingTile(rowIndex: number, tileIndex: number) {
    const tile = this.state.tilePlacesStats[rowIndex]?.[tileIndex]
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
      this.state.temporaryObjects.monasteries.push({
        followers: [],
        id: 'id' + Math.random(),
        isMonastery: true,
        points: [
          {
            x: tile.x,
            y: tile.y,
            direction: PointDirection.Center,
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
      this.state.temporaryObjects.gardens.push({
        followers: [],
        id: 'id' + Math.random(),
        isGarden: true,
        points: [
          {
            x: tile.x,
            y: tile.y,
            direction: PointDirection.Center,
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

  checkRoads(roadsPoints: Point[], connectedGroups?: Point[][]) {
    this.checkConnectedFeatures(TileSideType.Road, roadsPoints, connectedGroups)
  }

  mergeRoads(roadsIds: string[], roadsPoints: Point[]) {
    this.mergeLinearFeature(TileSideType.Road, roadsIds, roadsPoints)
  }

  checkCompleteRoad(road: BaseObject) {
    this.checkCompleteLinearFeature(TileSideType.Road, road)
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
    const featureGroups = this.state.getTileFeatureGroups(tile, feature)
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
    const completedObjects = this.state.temporaryObjects[collection].filter(
      (object) => {
        const point = object.points[0]
        if (!point) return false

        return CENTRAL_OBJECT_NEIGHBORS.every(([dy, dx]) =>
          Boolean(this.state.tilePlacesStats[point.y + dy]?.[point.x + dx])
        )
      }
    )

    const completedIds = new Set(completedObjects.map(({ id }) => id))
    this.state.temporaryObjects[collection] = this.state.temporaryObjects[
      collection
    ].filter((object) => !completedIds.has(object.id))
    this.state.completedObjects[collection] = [
      ...this.state.completedObjects[collection],
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

        this.state.scores[follower.playerId] += 9
        const { details, modifiers } = describeCompletedCentralObject(
          objectType === ObjectTypes.GARDEN ? 'сада' : 'монастыря'
        )
        this.state.recordAction({
          actionType: ActionTypes.ADDING_SCORES,
          actionData: {
            objectType,
            objectData: object,
            score: {
              objectId: object.id,
              players: { [follower.playerId]: 9 },
              total: 9,
            },
            details,
            modifiers,
          },
        })
        if (follower.isBigFollower) {
          const pool = this.state.playersFollowers[follower.playerId]
          if (pool.bigFollowers !== undefined) pool.bigFollowers += 1
        } else {
          this.state.playersFollowers[follower.playerId].ordinaryFollowers += 1
        }
        this.removePlacedFollower(follower)
        this.state.recordAction({
          actionType: ActionTypes.BACK_FOLLOWER,
          actionData: { followers: [follower] },
        })
      }
    }
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

      const connectedIds = this.state.temporaryObjects[collection]
        .filter((object) =>
          object.points.some((point) =>
            group.some((featurePoint) =>
              this.state.isOppositePoint(point, featurePoint)
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
    const existingObjects = this.state.temporaryObjects[collection]
    const placedTile =
      this.state.tilePlacesStats[newPoints[0]?.y ?? -1]?.[newPoints[0]?.x ?? -1]
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
      this.state.temporaryObjects[collection].push(object)
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

    this.state.temporaryObjects[collection] = existingObjects.filter(
      ({ id }) => !connectedIdSet.has(id)
    )
    this.state.temporaryObjects[collection].push(mergedObject)
    this.reassignFollowerObjectIds(mergedObject.followers, mergedObject.id)
    this.checkCompleteLinearFeature(kind, mergedObject)
  }

  private checkCompleteLinearFeature(
    kind: LinearFeatureKind,
    feature: BaseObject
  ) {
    const isComplete = feature.points.every((point) => {
      const pointCoordinates = this.state.getPrecisionCoordinates(point)
      return feature.points.some((otherPoint) => {
        const otherPointCoordinates =
          this.state.getPrecisionCoordinates(otherPoint)
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
        ? this.state.calcScoreForRoad(feature)
        : this.state.calcScoreForCity(feature)
    this.state.temporaryObjects[collection] = this.state.temporaryObjects[
      collection
    ].filter(({ id }) => id !== feature.id)
    this.state.completedObjects[collection].push({
      ...deepClone(feature),
      score,
    })

    if (feature.followers.length) {
      const { details, modifiers } =
        kind === TileSideType.Road
          ? this.state.describeScoreForRoad(feature)
          : this.state.describeScoreForCity(feature)
      this.state.recordAction({
        actionType: ActionTypes.ADDING_SCORES,
        actionData: {
          objectType: LINEAR_FEATURE_TYPES[kind],
          objectData: feature,
          score,
          details,
          modifiers,
        },
      })
    }

    for (const follower of feature.followers) {
      if (follower.isBigFollower) {
        const pool = this.state.playersFollowers[follower.playerId]
        if (pool.bigFollowers !== undefined) pool.bigFollowers += 1
      } else {
        this.state.playersFollowers[follower.playerId].ordinaryFollowers += 1
      }
      this.removePlacedFollower(follower)
    }

    if (feature.followers.length) {
      this.state.recordAction({
        actionType: ActionTypes.BACK_FOLLOWER,
        actionData: { followers: feature.followers },
      })
    }
  }

  private removePlacedFollower(follower: ObjectFollower) {
    const index = this.state.placedFollowers.findIndex(
      (placed) =>
        String(placed.playerId) === String(follower.playerId) &&
        placed.point.x === follower.point.x &&
        placed.point.y === follower.point.y &&
        placed.point.direction === follower.point.direction &&
        Boolean(placed.isAbbot) === Boolean(follower.isAbbot) &&
        Boolean(placed.isBigFollower) === Boolean(follower.isBigFollower)
    )
    if (index >= 0) this.state.placedFollowers.splice(index, 1)
  }

  private reassignFollowerObjectIds(
    followers: ObjectFollower[],
    objectId: string
  ) {
    for (const follower of followers) {
      follower.objectId = objectId
      const placed = this.state.placedFollowers.find(
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
}
