import type { GameAction, NewGameAction } from './GameManager'
import { deepClone } from '../utils/common'
import { CENTRAL_OBJECT_NAMES, describeCompletedCentralObject } from './scoring'
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
}

/** Признак объекта в центре тайла, по которому он находится на доске. */
const CENTRAL_OBJECT_FLAGS: Record<
  CentralObjectKind,
  Pick<BaseObject, 'isMonastery' | 'isGarden'>
> = {
  [ObjectTypes.MONASTERY]: { isMonastery: true },
  [ObjectTypes.GARDEN]: { isGarden: true },
}

/**
 * Совпадение двух подданных одного игрока: игрок, клетка и тип фишки.
 * Идентификатор объекта не учитывается — при слиянии дорог и городов объект
 * меняется, а фишка остаётся той же.
 */
function isSameFollower(
  placed: PlacedFollower | ObjectFollower,
  follower: PlacedFollower | ObjectFollower
): boolean {
  return (
    String(placed.playerId) === String(follower.playerId) &&
    placed.point.x === follower.point.x &&
    placed.point.y === follower.point.y &&
    placed.point.direction === follower.point.direction &&
    Boolean(placed.isAbbot) === Boolean(follower.isAbbot) &&
    Boolean(placed.isBigFollower) === Boolean(follower.isBigFollower)
  )
}

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

  /**
   * Обрабатывает только что поставленный тайл: находит появившиеся участки
   * дороги и города, объединяет их с соседними и проверяет завершение.
   */
  checkGridAfterPlacingTile(rowIndex: number, tileIndex: number) {
    const tile = this.state.tilePlacesStats[rowIndex]?.[tileIndex]
    if (!tile) return

    this.checkLinearFeatureOnTile(tile, rowIndex, tileIndex)

    this.checkMonasteries(tile)
    this.checkGardens(tile)
  }

  /** Дороги и города одного вида на тайле разбираются одинаково. */
  private checkLinearFeatureOnTile(
    tile: GridTile,
    rowIndex: number,
    tileIndex: number
  ) {
    for (const kind of [
      TileSideType.Road,
      TileSideType.City,
    ] as LinearFeatureKind[]) {
      const featurePoints = this.getFeaturePoints(
        tile,
        rowIndex,
        tileIndex,
        kind
      )
      this.checkConnectedFeatures(
        kind,
        featurePoints,
        this.getConnectedFeatureGroups(tile, featurePoints, kind)
      )
    }
  }

  /** Монастырь стоит в центре тайла, поэтому игнорирует поворот. */
  checkMonasteries(tile: GridTile) {
    this.addCentralObject(ObjectTypes.MONASTERY, tile, tile.isMonastery)
  }

  checkCompletedMonasteries() {
    this.checkCompletedCentralObjects(ObjectTypes.MONASTERY)
  }

  calcScoreForMonasteries(monasteries: BaseObject[]) {
    this.calcScoreForCentralObjects(monasteries, ObjectTypes.MONASTERY)
  }

  /** Сад, как и монастырь, занимает центр тайла, но ставится только на свой тайл. */
  checkGardens(tile: GridTile) {
    this.addCentralObject(ObjectTypes.GARDEN, tile, tile.hasGarden)
  }

  checkCompletedGardens() {
    this.checkCompletedCentralObjects(ObjectTypes.GARDEN)
  }

  calcScoreForGardens(gardens: BaseObject[]) {
    this.calcScoreForCentralObjects(gardens, ObjectTypes.GARDEN)
  }

  /** Создаёт объект в центре тайла, если такой тайл только что поставлен. */
  private addCentralObject(
    kind: CentralObjectKind,
    tile: GridTile,
    hasFeature: boolean | undefined
  ) {
    if (hasFeature) {
      this.state.temporaryObjects[CENTRAL_OBJECT_COLLECTIONS[kind]].push({
        followers: [],
        id: 'id' + Math.random(),
        ...CENTRAL_OBJECT_FLAGS[kind],
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

    this.checkCompletedCentralObjects(kind)
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

  /**
   * Завершённый монастырь или сад всегда приносит 9 очков каждому подданному.
   * Аббат остаётся на объекте до отзыва владельцем, поэтому не возвращается.
   */
  private calcScoreForCentralObjects(
    objects: BaseObject[],
    objectType: CentralObjectKind
  ) {
    const details = describeCompletedCentralObject(
      CENTRAL_OBJECT_NAMES[objectType]
    )

    for (const object of objects) {
      for (const follower of object.followers) {
        if (follower.isAbbot) continue

        this.state.scores[follower.playerId] += 9
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
            ...details,
          },
        })
        this.returnFollowerToPool(follower)
        this.state.recordAction({
          actionType: ActionTypes.BACK_FOLLOWER,
          actionData: { followers: [{ ...follower, objectType }] },
        })
      }
    }
  }

  /** Фишка уходит с поля и возвращается в запас владельца. */
  private returnFollowerToPool(follower: ObjectFollower) {
    const pool = this.state.playersFollowers[follower.playerId]
    if (follower.isBigFollower) {
      if (pool.bigFollowers !== undefined) pool.bigFollowers += 1
    } else {
      pool.ordinaryFollowers += 1
    }
    this.removePlacedFollower(follower)
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

  /**
   * Дорога и город завершены, когда каждая точка участка имеет пару с другой
   * стороны той же клетки (то есть у каждого конца есть продолжение).
   * Завершённый объект уходит в завершённые, а его подданные получают очки,
   * возвращаются в запас и записываются в историю как снятые с поля.
   */
  private checkCompleteLinearFeature(
    kind: LinearFeatureKind,
    feature: BaseObject
  ) {
    if (!this.isLinearFeatureComplete(feature)) return

    const collection = LINEAR_FEATURE_COLLECTIONS[kind]
    const objectType = LINEAR_FEATURE_TYPES[kind]
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

    if (!feature.followers.length) return

    this.state.recordAction({
      actionType: ActionTypes.ADDING_SCORES,
      actionData: {
        objectType,
        objectData: feature,
        score,
        ...(kind === TileSideType.Road
          ? this.state.describeScoreForRoad(feature)
          : this.state.describeScoreForCity(feature)),
      },
    })
    for (const follower of feature.followers) {
      this.returnFollowerToPool(follower)
    }
    this.state.recordAction({
      actionType: ActionTypes.BACK_FOLLOWER,
      actionData: {
        followers: feature.followers.map((follower) => ({
          ...follower,
          objectType,
        })),
      },
    })
  }

  private isLinearFeatureComplete(feature: BaseObject): boolean {
    return feature.points.every((point) => {
      const coordinates = this.state.getPrecisionCoordinates(point)
      return feature.points.some((otherPoint) => {
        const otherCoordinates = this.state.getPrecisionCoordinates(otherPoint)
        return (
          coordinates.x === otherCoordinates.x &&
          coordinates.y === otherCoordinates.y &&
          point.direction !== otherPoint.direction
        )
      })
    })
  }

  private removePlacedFollower(follower: ObjectFollower) {
    const index = this.state.placedFollowers.findIndex((placed) =>
      isSameFollower(placed, follower)
    )
    if (index >= 0) this.state.placedFollowers.splice(index, 1)
  }

  /**
   * После слияния подданные переходят на новый объект: идентификатор в истории
   * и на доске должен совпадать с идентификатором объединённого объекта.
   */
  private reassignFollowerObjectIds(
    followers: ObjectFollower[],
    objectId: string
  ) {
    for (const follower of followers) {
      follower.objectId = objectId
      const placed = this.state.placedFollowers.find((candidate) =>
        isSameFollower(candidate, follower)
      )
      if (placed) placed.objectId = objectId
    }
  }
}
