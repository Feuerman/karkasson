import { CENTRAL_OBJECT_NAMES, describeCompletedCentralObject } from './scoring'
import {
  followerTypeOf,
  removePlacedFollower,
  returnFollower,
} from './followerPool'
import { isSameFollowerPoint } from './followerMatching'
import { getPrecisionCoordinates, isOppositePoint } from './gameGeometry'
import type { ObjectBoard } from './boardState'
import {
  ActionTypes,
  ObjectTypes,
  ExpansionName,
  PointDirection,
  SIDE_NAMES,
  TileSideType,
  type BaseObject,
  type ObjectFollower,
  type Point,
  type ScoreDetails,
  type ScoreForObject,
  type GridTile,
  type SideName,
} from './types'

type CentralObjectKind = ObjectTypes.MONASTERY | ObjectTypes.GARDEN
type LinearFeatureKind = typeof TileSideType.Road | typeof TileSideType.City

/**
 * Свойства дороги и города одного вида: одинаково находятся на доске,
 * одинаково сливаются и одинаково считаются.
 */
interface LinearFeatureHandlers {
  /** Коллекция объектов доски этого вида. */
  collection: 'roads' | 'cities'
  /** Тип объекта в истории. */
  objectType: ObjectTypes
  /** Признаки бонуса расширения на тайле: таверна у дороги, собор у города. */
  bonusFlags: { hasInn: boolean; hasCathedral: boolean }
  calcScore(state: ObjectBoard, feature: BaseObject): ScoreForObject
  describeScore(state: ObjectBoard, feature: BaseObject): ScoreDetails
}

const LINEAR_FEATURE_HANDLERS: Record<
  LinearFeatureKind,
  LinearFeatureHandlers
> = {
  [TileSideType.Road]: {
    collection: 'roads',
    objectType: ObjectTypes.ROAD,
    bonusFlags: { hasInn: true, hasCathedral: false },
    calcScore: (state, feature) => state.calcScoreForRoad(feature),
    describeScore: (state, feature) => state.describeScoreForRoad(feature),
  },
  [TileSideType.City]: {
    collection: 'cities',
    objectType: ObjectTypes.CITY,
    bonusFlags: { hasInn: false, hasCathedral: true },
    calcScore: (state, feature) => state.calcScoreForCity(feature),
    describeScore: (state, feature) => state.describeScoreForCity(feature),
  },
}

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

/** Owns feature-object discovery, merging, completion and follower return. */
export class GameObjectManager {
  constructor(private readonly state: ObjectBoard) {}

  /**
   * Обрабатывает только что поставленный тайл: находит появившиеся участки
   * дороги и города, объединяет их с соседними и проверяет завершение.
   */
  checkGridAfterPlacingTile(rowIndex: number, tileIndex: number) {
    const tile = this.state.tilePlacesStats[rowIndex]?.[tileIndex]
    if (!tile) return

    this.checkLinearFeatureOnTile(tile, rowIndex, tileIndex)

    this.addCentralObject(ObjectTypes.MONASTERY, tile, tile.isMonastery)
    this.addCentralObject(ObjectTypes.GARDEN, tile, tile.hasGarden)
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
        this.getConnectedFeatureGroups(tile, featurePoints, kind)
      )
    }
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

  /**
   * Точки тайла, разложенные по группам соединённых сторон: в группу попадает
   * каждая точка, чья сторона входит в неё. Стороны сверяются по именам
   * направлений, поэтому порядок ключей `sides` значения не имеет.
   */
  private getConnectedFeatureGroups(
    tile: GridTile,
    featurePoints: Point[],
    feature: LinearFeatureKind
  ): Point[][] {
    const featureGroups = this.state.getTileFeatureGroups(tile, feature)

    return featureGroups
      .map((directions) => {
        const group = new Set<SideName>(directions)
        return featurePoints.filter((point) =>
          SIDE_NAMES.some(
            (direction) => direction === point.direction && group.has(direction)
          )
        )
      })
      .filter((group) => group.length > 0)
  }

  /**
   * Монастыри и сады, вокруг которых заняты все девять клеток: они уходят в
   * завершённые и приносят очки. Вызывается после постановки тайла и при
   * проверке объекта в изоляции от ходов.
   */
  checkCompletedCentralObjects(kind: CentralObjectKind) {
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
    if (pool) returnFollower(pool, followerTypeOf(follower))
    removePlacedFollower(this.state, follower)
  }

  private checkConnectedFeatures(kind: LinearFeatureKind, groups: Point[][]) {
    const collection = LINEAR_FEATURE_HANDLERS[kind].collection

    for (const group of groups) {
      if (!group.length) continue

      const connectedIds = this.state.temporaryObjects[collection]
        .filter((object) =>
          object.points.some((point) =>
            group.some((featurePoint) => isOppositePoint(point, featurePoint))
          )
        )
        .map((object) => object.id)

      this.mergeLinearFeature(kind, connectedIds, group)
    }
  }

  /**
   * Присоединяет новый участок дороги или города к соседним объектам: при
   * отсутствии соседей создаёт объект, при одном — дополняет его, при
   * нескольких — объединяет их в один.
   */
  mergeLinearFeature(
    kind: LinearFeatureKind,
    connectedIds: string[],
    newPoints: Point[]
  ) {
    const handlers = LINEAR_FEATURE_HANDLERS[kind]
    const collection = handlers.collection
    const existingObjects = this.state.temporaryObjects[collection]
    const firstPoint = newPoints[0]
    const placedTile = firstPoint
      ? this.state.tilePlacesStats[firstPoint.y]?.[firstPoint.x]
      : undefined
    const bonusFlags = handlers.bonusFlags
    const hasInn = bonusFlags.hasInn && Boolean(placedTile?.hasInn)
    const hasCathedral =
      bonusFlags.hasCathedral && Boolean(placedTile?.hasCathedral)
    const isExpansionTile = Boolean(
      placedTile?.expansion === ExpansionName.InnsAndCathedrals &&
      (hasInn || hasCathedral)
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
        (bonusFlags.hasInn && connectedObjects.some((object) => object.hasInn))
      ),
      hasCathedral: Boolean(
        hasCathedral ||
        (bonusFlags.hasCathedral &&
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
  checkCompleteLinearFeature(kind: LinearFeatureKind, feature: BaseObject) {
    if (!this.isLinearFeatureComplete(feature)) return

    const handlers = LINEAR_FEATURE_HANDLERS[kind]
    const collection = handlers.collection
    const objectType = handlers.objectType
    const score = handlers.calcScore(this.state, feature)
    this.state.temporaryObjects[collection] = this.state.temporaryObjects[
      collection
    ].filter(({ id }) => id !== feature.id)
    this.state.completedObjects[collection].push({
      ...structuredClone(feature),
      score,
    })

    if (!feature.followers.length) return

    this.state.recordAction({
      actionType: ActionTypes.ADDING_SCORES,
      actionData: {
        objectType,
        objectData: feature,
        score,
        ...handlers.describeScore(this.state, feature),
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
      const coordinates = getPrecisionCoordinates(point)
      return feature.points.some((otherPoint) => {
        const otherCoordinates = getPrecisionCoordinates(otherPoint)
        return (
          coordinates.x === otherCoordinates.x &&
          coordinates.y === otherCoordinates.y &&
          point.direction !== otherPoint.direction
        )
      })
    })
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
        isSameFollowerPoint(candidate, follower)
      )
      if (placed) placed.objectId = objectId
    }
  }
}
