import type { GameAction } from './GameManager'
import { calcGardenPoints, calcMonasteryPoints } from './scoring'
import {
  ActionTypes,
  FollowerType as FollowerTypes,
  ObjectTypes,
  PointDirection as PointDirections,
  SIDE_NAMES,
  TileSideType,
  type AvailableFollowerPlace,
  type BaseObject,
  type FollowerCount,
  type FollowerType,
  type GridTile,
  type Player,
  type PlayerId,
  type PlacedFollower,
  type Point,
  type PointDirection,
  type Scores,
  type TemporaryObjects,
  type TilePlacesStats,
} from './types'

type LinearFeatureKind = typeof TileSideType.City | typeof TileSideType.Road

interface FollowerState {
  gameIsEnded: boolean
  currentTile: GridTile | null
  currentPlayer: Player | null
  playersFollowers: Record<PlayerId, FollowerCount>
  rules: {
    expansions: {
      innsAndCathedrals: boolean
    }
  }
  temporaryObjects: TemporaryObjects
  completedObjects: TemporaryObjects
  tilePlacesStats: TilePlacesStats
  availableFollowersPlaces: AvailableFollowerPlace[]
  isPlacingFollower: boolean
  placedFollowers: PlacedFollower[]
  scores: Scores
  actionsHistory: GameAction[]
  getTileFeatureGroups(
    tile: GridTile,
    feature: LinearFeatureKind
  ): Array<Array<(typeof SIDE_NAMES)[number]>>
  endTurn(): void
  findObjectByPoint(
    objects: TemporaryObjects,
    x: number,
    y: number,
    direction?: PointDirection
  ): BaseObject | undefined
}

/** Owns legal follower positions, placement, skipping and abbot recall. */
export class FollowerManager {
  constructor(private readonly state: FollowerState) {}

  checkAvailableFollowers() {
    if (!this.state.currentTile) return
    const currentPlayer = this.state.currentPlayer
    if (!currentPlayer) return

    const followerPool = this.state.playersFollowers[currentPlayer.id]
    if (
      followerPool &&
      !followerPool.ordinaryFollowers &&
      !(
        this.state.rules.expansions.innsAndCathedrals &&
        followerPool.bigFollowers
      ) &&
      !followerPool.monks
    ) {
      this.state.endTurn()
      return
    }

    this.state.availableFollowersPlaces = this.findAvailableFollowersPlaces(
      this.state.currentTile
    )

    if (this.state.availableFollowersPlaces.length) {
      this.goPlaceFollower()
    } else {
      this.state.endTurn()
    }
  }

  findAvailableFollowersPlaces(tile: GridTile): AvailableFollowerPlace[] {
    const currentPlayer = this.state.currentPlayer
    if (!currentPlayer) return []
    const followerPool = this.state.playersFollowers[currentPlayer.id]

    const sides: PointDirection[] = [...SIDE_NAMES]
    if (tile.isMonastery || tile.hasGarden) {
      sides.push(PointDirections.Center)
    }

    const candidates: {
      point: Point
      temporaryObject: BaseObject | undefined
    }[] = sides.map((side) => ({
      point: {
        x: tile.x,
        y: tile.y,
        direction: side,
        pointType:
          side === PointDirections.Center ? undefined : tile.sides[side],
      },
      temporaryObject: this.state.findObjectByPoint(
        this.state.temporaryObjects,
        tile.x,
        tile.y,
        side
      ),
    }))

    return candidates.filter((place): place is AvailableFollowerPlace => {
      const object = place.temporaryObject
      if (object === undefined || object.followers.length !== 0) {
        return false
      }
      const side = place.point.direction
      if (side && side !== PointDirections.Center) {
        const tileSideType = tile.sides[side]
        const featureGroups = this.state.getTileFeatureGroups(
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
            this.state.findObjectByPoint(
              this.state.temporaryObjects,
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
      // Сад доступен только аббату, и только если он есть в запасе.
      if (object.isGarden && !followerPool?.monks) {
        return false
      }
      if (place.point.direction === PointDirections.Center || object.isGarden) {
        return Boolean(followerPool?.monks)
      }
      if (
        followerPool &&
        !followerPool.ordinaryFollowers &&
        !(
          this.state.rules.expansions.innsAndCathedrals &&
          followerPool.bigFollowers
        )
      ) {
        return false
      }
      return true
    })
  }

  goPlaceFollower() {
    const currentPlayer = this.state.currentPlayer
    const followerPool = currentPlayer
      ? this.state.playersFollowers[currentPlayer.id]
      : null
    if (
      !currentPlayer ||
      !followerPool ||
      (!followerPool.ordinaryFollowers &&
        !(
          this.state.rules.expansions.innsAndCathedrals &&
          followerPool.bigFollowers
        ) &&
        !followerPool.monks)
    ) {
      this.state.endTurn()
    } else {
      this.state.currentTile = null
      this.state.isPlacingFollower = true
    }
  }

  placeFollower(
    availablePlace: AvailableFollowerPlace,
    followerType: FollowerType = FollowerTypes.Follower
  ) {
    if (this.state.gameIsEnded) return
    const activePlayer = this.state.currentPlayer
    if (!activePlayer) return

    const followerPool = this.state.playersFollowers[activePlayer.id]
    if (!followerPool) {
      this.skipFollower()
      return
    }

    const temporaryObject = this.state.findObjectByPoint(
      this.state.temporaryObjects,
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

    const follower = this.resolveFollowerType(
      followerType,
      temporaryObject,
      followerPool
    )
    if (!follower) {
      this.skipFollower()
      return
    }

    this.consumeFollower(activePlayer.id, follower.type)
    temporaryObject.followers.push({
      playerId: activePlayer.id,
      objectId: temporaryObject.id,
      point: availablePlace.point,
      isAbbot: follower.isAbbot || undefined,
      isBigFollower: follower.isBigFollower || undefined,
    })

    this.state.placedFollowers.push({
      playerId: activePlayer.id,
      objectId: temporaryObject.id,
      point: availablePlace.point,
      isMonastery: temporaryObject.isMonastery,
      isGarden: temporaryObject.isGarden,
      isAbbot: follower.isAbbot || undefined,
      isBigFollower: follower.isBigFollower || undefined,
    })

    this.state.availableFollowersPlaces = []
    this.state.actionsHistory.push({
      actionType: ActionTypes.PLACE_FOLLOWER,
      actionData: {
        ...availablePlace,
        followerType: follower.type,
      },
      initiator: activePlayer,
    })

    this.state.endTurn()
  }

  skipFollower() {
    this.state.availableFollowersPlaces = []
    this.state.endTurn()
  }

  recallAbbot(): boolean {
    if (this.state.gameIsEnded) return false
    const currentPlayer = this.state.currentPlayer
    if (!currentPlayer) return false

    const playerKey = String(currentPlayer.id)
    const centerObjects = [
      ...this.state.temporaryObjects.monasteries,
      ...this.state.completedObjects.monasteries,
      ...this.state.temporaryObjects.gardens,
      ...this.state.completedObjects.gardens,
    ]
    const target = centerObjects.find((object) =>
      object.followers.some(
        (follower) =>
          follower.isAbbot && String(follower.playerId) === playerKey
      )
    )
    if (!target) return false

    const abbot = target.followers.find(
      (follower) => follower.isAbbot && String(follower.playerId) === playerKey
    )
    if (!abbot) return false

    const points = this.countCenterObjectPoints(target)
    this.state.scores[currentPlayer.id] =
      (this.state.scores[currentPlayer.id] ?? 0) + points

    this.state.actionsHistory.push({
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

    target.followers = target.followers.filter((follower) => follower !== abbot)
    const placedIndex = this.state.placedFollowers.findIndex(
      (follower) =>
        follower.isAbbot &&
        follower.objectId === target.id &&
        String(follower.playerId) === playerKey
    )
    if (placedIndex !== -1) this.state.placedFollowers.splice(placedIndex, 1)

    this.state.playersFollowers[currentPlayer.id].monks += 1
    this.state.actionsHistory.push({
      actionType: ActionTypes.BACK_FOLLOWER,
      actionData: { followers: [abbot] },
    })
    return true
  }

  isFollowerPlacementAvailable(
    place: AvailableFollowerPlace,
    object: BaseObject
  ): boolean {
    const side = place.point.direction
    if (!side || side === PointDirections.Center)
      return object.followers.length === 0

    const tile = this.state.tilePlacesStats[place.point.y]?.[place.point.x]
    if (!tile) return false
    const type = tile.sides[side]
    const groups = this.state.getTileFeatureGroups(
      tile,
      type === TileSideType.City ? TileSideType.City : TileSideType.Road
    )
    const group = groups.find((directions) => directions.includes(side)) ?? [
      side,
    ]

    return group.every((direction) => {
      const connectedObject = this.state.findObjectByPoint(
        this.state.temporaryObjects,
        place.point.x,
        place.point.y,
        direction
      )
      if (connectedObject) return connectedObject.followers.length === 0
      return object.followers.length === 0
    })
  }

  simulatePlaceFollower(
    availablePlace: AvailableFollowerPlace,
    followerType: FollowerType = FollowerTypes.Follower
  ): boolean {
    const currentPlayer = this.state.currentPlayer
    const followerPool = currentPlayer
      ? this.state.playersFollowers[currentPlayer.id]
      : null
    if (!currentPlayer || !followerPool) return false

    const targetObject = this.state.findObjectByPoint(
      this.state.temporaryObjects,
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

    const follower = this.resolveFollowerType(
      followerType,
      targetObject,
      followerPool
    )
    if (!follower) return false

    this.consumeFollower(currentPlayer.id, follower.type)
    targetObject.followers.push({
      playerId: currentPlayer.id,
      objectId: targetObject.id,
      point: availablePlace.point,
      isAbbot: follower.isAbbot || undefined,
      isBigFollower: follower.isBigFollower || undefined,
    })
    this.state.placedFollowers.push({
      playerId: currentPlayer.id,
      objectId: targetObject.id,
      point: availablePlace.point,
      isMonastery: targetObject.isMonastery,
      isGarden: targetObject.isGarden,
      isAbbot: follower.isAbbot || undefined,
      isBigFollower: follower.isBigFollower || undefined,
    })
    return true
  }

  private resolveFollowerType(
    followerType: FollowerType,
    object: BaseObject,
    pool: FollowerCount
  ):
    | { type: FollowerType; isAbbot: boolean; isBigFollower: boolean }
    | undefined {
    const isAbbot = followerType === FollowerTypes.Abbot
    const isBigFollower = followerType === FollowerTypes.BigFollower
    const isCenterFeature = Boolean(object.isMonastery || object.isGarden)
    if (isAbbot) {
      if (!pool.monks || !isCenterFeature) return undefined
    } else if (
      (isBigFollower
        ? !this.state.rules.expansions.innsAndCathedrals || !pool.bigFollowers
        : !pool.ordinaryFollowers) ||
      object.isGarden ||
      (isBigFollower && !this.state.rules.expansions.innsAndCathedrals)
    ) {
      return undefined
    }
    return {
      type: isAbbot
        ? FollowerTypes.Abbot
        : isBigFollower
          ? FollowerTypes.BigFollower
          : FollowerTypes.Follower,
      isAbbot,
      isBigFollower,
    }
  }

  private consumeFollower(playerId: PlayerId, followerType: FollowerType) {
    if (followerType === FollowerTypes.Abbot) {
      this.state.playersFollowers[playerId].monks -= 1
    } else if (followerType === FollowerTypes.BigFollower) {
      const pool = this.state.playersFollowers[playerId]
      if (pool.bigFollowers !== undefined) pool.bigFollowers -= 1
    } else {
      this.state.playersFollowers[playerId].ordinaryFollowers -= 1
    }
  }

  private countCenterObjectPoints(object: BaseObject): number {
    return object.isGarden
      ? calcGardenPoints(this.state.tilePlacesStats, object)
      : calcMonasteryPoints(this.state.tilePlacesStats, object)
  }
}
