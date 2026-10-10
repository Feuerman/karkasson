import type { GameAction, NewGameAction } from './GameManager'
import {
  calcGardenPoints,
  calcMonasteryPoints,
  describeCentralObjectPoints,
} from './scoring'
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
  type ObjectFollower,
  type Player,
  type PlayerId,
  type PlacedFollower,
  type Point,
  type PointDirection,
  type SideName,
  type Scores,
  type TemporaryObjects,
  type TilePlacesStats,
} from './types'

type LinearFeatureKind = typeof TileSideType.City | typeof TileSideType.Road

/** Кандидат на место подданного до проверки допустимости. */
interface FollowerPlaceCandidate {
  point: Point
  temporaryObject: BaseObject | undefined
}

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
  recordAction(action: NewGameAction): void
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

    if (!this.hasAnyFollowers(this.state.playersFollowers[currentPlayer.id])) {
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

    // Монастырь и сад занимают центр тайла, остальные объекты — стороны.
    const sides: PointDirection[] = [...SIDE_NAMES]
    if (tile.isMonastery || tile.hasGarden) {
      sides.push(PointDirections.Center)
    }

    const candidates: FollowerPlaceCandidate[] = sides.map((side) => ({
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

    return candidates.filter((place): place is AvailableFollowerPlace =>
      this.isPlaceAvailable(place, tile, followerPool)
    )
  }

  /**
   * Место доступно, если объект есть, ещё свободен и в запасе активного
   * игрока есть фишка, которой этот объект можно занять.
   */
  private isPlaceAvailable(
    place: FollowerPlaceCandidate,
    tile: GridTile,
    followerPool: FollowerCount | undefined
  ): boolean {
    const object = place.temporaryObject
    if (object === undefined || object.followers.length !== 0) return false

    const side = place.point.direction
    if (!side) return this.hasCommonFollowers(followerPool)

    // Сад занимает только аббат. В монастырь можно поставить любого
    // подданного — он станет монахом, — а вот на стороне тайла аббата быть
    // не может.
    if (side === PointDirections.Center) {
      return object.isGarden
        ? this.hasAbbot(followerPool)
        : this.hasAnyFollowers(followerPool)
    }

    return (
      this.hasCommonFollowers(followerPool) &&
      this.isConnectedGroupFree(tile, side)
    )
  }

  /**
   * Подданный ставится на всю группу соединённых сторон тайла: если хотя бы
   * у одного сегмента группы уже есть подданный, группа занята.
   */
  private isConnectedGroupFree(tile: GridTile, side: SideName): boolean {
    const tileSideType = tile.sides[side]
    const featureGroups = this.state.getTileFeatureGroups(
      tile,
      tileSideType === TileSideType.City ? TileSideType.City : TileSideType.Road
    )
    const group = featureGroups.find((directions) =>
      directions.includes(side)
    ) ?? [side]

    return group.every((direction) => {
      const connectedObject = this.state.findObjectByPoint(
        this.state.temporaryObjects,
        tile.x,
        tile.y,
        direction
      )
      return (connectedObject?.followers.length ?? 0) === 0
    })
  }

  goPlaceFollower() {
    const currentPlayer = this.state.currentPlayer
    const followerPool = currentPlayer
      ? this.state.playersFollowers[currentPlayer.id]
      : null
    if (!currentPlayer || !this.hasAnyFollowers(followerPool)) {
      this.state.endTurn()
    } else {
      this.state.currentTile = null
      this.state.isPlacingFollower = true
    }
  }

  /** Обычные подданные и, при расширении, большие подданные. */
  private hasCommonFollowers(pool: FollowerCount | undefined | null): boolean {
    if (!pool) return false
    return Boolean(
      pool.ordinaryFollowers ||
      (this.state.rules.expansions.innsAndCathedrals && pool.bigFollowers)
    )
  }

  /** Аббат хранится в запасе как монах. */
  private hasAbbot(pool: FollowerCount | undefined | null): boolean {
    return Boolean(pool?.monks)
  }

  /** Есть ли хоть одна фишка, которой игрок может начать ход. */
  private hasAnyFollowers(pool: FollowerCount | undefined | null): boolean {
    return this.hasCommonFollowers(pool) || this.hasAbbot(pool)
  }

  /**
   * Выставляет подданного активного игрока. Все проверки заново выполняются по
   * состоянию партии: присланное клиентом место могло устареть.
   */
  placeFollower(
    availablePlace: AvailableFollowerPlace,
    followerType: FollowerType = FollowerTypes.Follower
  ) {
    if (this.state.gameIsEnded) return

    const placedFollowerType = this.applyFollowerPlacement(
      availablePlace,
      followerType
    )
    if (!placedFollowerType) {
      this.skipFollower()
      return
    }

    this.state.availableFollowersPlaces = []
    this.state.recordAction({
      actionType: ActionTypes.PLACE_FOLLOWER,
      actionData: { ...availablePlace, followerType: placedFollowerType },
      initiator: this.state.currentPlayer,
    })
    this.state.endTurn()
  }

  skipFollower() {
    this.state.availableFollowersPlaces = []
    this.state.endTurn()
  }

  /**
   * Отзыв аббата в ход владельца: аббат снимается с монастыря или сада
   * (завершённого или нет) и начисляются очки за «незавершённый» объект —
   * 1 очко за сам тайл и по 1 очку за каждую занятую клетку в окрестности 3×3.
   * Ход не расходуется: игрок после отзыва продолжает свой ход.
   */
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
    const isOwnAbbot = (follower: ObjectFollower) =>
      Boolean(follower.isAbbot) && String(follower.playerId) === playerKey

    const target = centerObjects.find((object) =>
      object.followers.some(isOwnAbbot)
    )
    if (!target) return false
    const abbot = target.followers.find(isOwnAbbot)
    if (!abbot) return false

    const objectType = target.isGarden
      ? ObjectTypes.GARDEN
      : ObjectTypes.MONASTERY
    const points = this.countCenterObjectPoints(target)
    this.state.scores[currentPlayer.id] =
      (this.state.scores[currentPlayer.id] ?? 0) + points

    this.state.recordAction({
      actionType: ActionTypes.ADDING_SCORES,
      actionData: {
        objectType,
        objectData: target,
        score: {
          objectId: target.id,
          players: { [currentPlayer.id]: points },
          total: points,
        },
        ...describeCentralObjectPoints(
          points,
          target.isGarden ? 'сада' : 'монастыря'
        ),
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
    this.state.recordAction({
      actionType: ActionTypes.BACK_FOLLOWER,
      actionData: {
        followers: [
          {
            ...abbot,
            objectType,
          },
        ],
      },
    })
    return true
  }

  /**
   * Повторная проверка места перед постановкой фишки: весь участок должен быть
   * свободен. Центр тайла занимается, только если объект пуст.
   */
  isFollowerPlacementAvailable(
    place: AvailableFollowerPlace,
    object: BaseObject
  ): boolean {
    const side = place.point.direction
    if (!side || side === PointDirections.Center)
      return object.followers.length === 0

    const tile = this.state.tilePlacesStats[place.point.y]?.[place.point.x]
    if (!tile) return false
    return this.isConnectedGroupFree(tile, side)
  }

  /**
   * Пробная постановка подданного для оценки хода ИИ: те же проверки и
   * изменения состояния, что и в реальном ходу, но без записи в историю и без
   * перехода хода.
   */
  simulatePlaceFollower(
    availablePlace: AvailableFollowerPlace,
    followerType: FollowerType = FollowerTypes.Follower
  ): boolean {
    return (
      this.applyFollowerPlacement(availablePlace, followerType) !== undefined
    )
  }

  /**
   * Общая часть реального и пробного хода: проверки допустимости, списание
   * фишки из запаса и постановка на объект. Возвращает тип выставленной фишки
   * или `undefined`, если ход невозможен.
   */
  private applyFollowerPlacement(
    availablePlace: AvailableFollowerPlace,
    followerType: FollowerType
  ): FollowerType | undefined {
    const activePlayer = this.state.currentPlayer
    if (!activePlayer) return undefined
    const followerPool = this.state.playersFollowers[activePlayer.id]
    if (!followerPool) return undefined

    // Объект искать заново: клиент прислал место, а не фишку, и объект мог
    // с тех пор объединиться с соседним или быть уже занят.
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
      return undefined
    }
    if (!this.isFollowerPlacementAvailable(availablePlace, targetObject)) {
      return undefined
    }

    const follower = this.resolveFollowerType(
      followerType,
      targetObject,
      followerPool
    )
    if (!follower) return undefined

    this.consumeFollower(activePlayer.id, follower.type)
    const placement = {
      playerId: activePlayer.id,
      objectId: targetObject.id,
      point: availablePlace.point,
      isAbbot: follower.isAbbot || undefined,
      isBigFollower: follower.isBigFollower || undefined,
    }
    targetObject.followers.push(placement)
    this.state.placedFollowers.push({
      ...placement,
      isMonastery: targetObject.isMonastery,
      isGarden: targetObject.isGarden,
    })
    return follower.type
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
