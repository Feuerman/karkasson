import type { GameAction, NewGameAction } from './gameActions'
import { countCenterObjectPoints, describeCentralObjectPoints } from './scoring'
import {
  ActionTypes,
  FollowerType as FollowerTypes,
  ObjectTypes,
  PointDirection as PointDirections,
  SIDE_NAMES,
  TileSideType,
  type AbbotRecallInfo,
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
  princessFollowerPenalty?: boolean
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

    // Штраф принцессы: способность сработала, на этот тайл фишку ставить
    // нельзя. Ход всё равно нужно завершить, поэтому панель остаётся — с ней
    // игрок может ещё отозвать аббата и пропустить выставление.
    if (this.state.princessFollowerPenalty) {
      this.state.availableFollowersPlaces = []
      this.goPlaceFollower()
      return
    }

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
   * Типы фишек, которые активный игрок может поставить в это место прямо
   * сейчас. Список отдаётся клиенту, чтобы интерфейс не решал правила сам, и
   * используется симулятором при переборе ходов.
   */
  getAvailableFollowerTypes(place: AvailableFollowerPlace): FollowerType[] {
    const currentPlayer = this.state.currentPlayer
    const pool = currentPlayer
      ? this.state.playersFollowers[currentPlayer.id]
      : undefined
    if (!pool) return []
    return this.allowedFollowerTypes(place.temporaryObject, pool)
  }

  /**
   * Правило допустимости типа фишки для объекта: в сад ставится только аббат,
   * на монастырь — любой подданный, на стороне тайла аббата быть не может, а
   * большой подданный существует только в дополнении «Таверны и соборы».
   */
  private allowedFollowerTypes(
    object: BaseObject,
    pool: FollowerCount
  ): FollowerType[] {
    const followerTypes: FollowerType[] = []
    const isCenterFeature = Boolean(object.isMonastery || object.isGarden)

    if (!object.isGarden && pool.ordinaryFollowers) {
      followerTypes.push(FollowerTypes.Follower)
    }
    if (
      !object.isGarden &&
      this.state.rules.expansions.innsAndCathedrals &&
      pool.bigFollowers
    ) {
      followerTypes.push(FollowerTypes.BigFollower)
    }
    if (isCenterFeature && pool.monks) {
      followerTypes.push(FollowerTypes.Abbot)
    }
    return followerTypes
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
   * Что даст отзыв аббата в ход владельца: объект, с которого он снимется, и
   * очки за незавершённый объект. `null`, если отзывать нечего.
   */
  getAbbotRecallInfo(): AbbotRecallInfo | null {
    if (this.state.gameIsEnded) return null
    const currentPlayer = this.state.currentPlayer
    if (!currentPlayer) return null

    const found = this.findOwnAbbot(String(currentPlayer.id))
    if (!found) return null

    const { object } = found
    return {
      objectId: object.id,
      objectType: object.isGarden ? ObjectTypes.GARDEN : ObjectTypes.MONASTERY,
      points: this.countCenterObjectPoints(object),
    }
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
    const found = this.findOwnAbbot(playerKey)
    if (!found) return false
    const { object: target, abbot } = found

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
   * Аббат игрока на центральном объекте: сад или монастырь, в том числе уже
   * завершённый.
   */
  private findOwnAbbot(
    playerKey: string
  ): { object: BaseObject; abbot: ObjectFollower } | undefined {
    const centerObjects = [
      ...this.state.temporaryObjects.monasteries,
      ...this.state.completedObjects.monasteries,
      ...this.state.temporaryObjects.gardens,
      ...this.state.completedObjects.gardens,
    ]
    const isOwnAbbot = (follower: ObjectFollower) =>
      Boolean(follower.isAbbot) && String(follower.playerId) === playerKey

    const object = centerObjects.find((centerObject) =>
      centerObject.followers.some(isOwnAbbot)
    )
    if (!object) return undefined

    const abbot = object.followers.find(isOwnAbbot)
    if (!abbot) return undefined
    return { object, abbot }
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

  /**
   * Проверка присланного клиентом типа по правилам допустимости: если типа
   * среди разрешённых для объекта нет, ход невозможен.
   */
  private resolveFollowerType(
    followerType: FollowerType,
    object: BaseObject,
    pool: FollowerCount
  ):
    | { type: FollowerType; isAbbot: boolean; isBigFollower: boolean }
    | undefined {
    if (!this.allowedFollowerTypes(object, pool).includes(followerType)) {
      return undefined
    }
    return {
      type: followerType,
      isAbbot: followerType === FollowerTypes.Abbot,
      isBigFollower: followerType === FollowerTypes.BigFollower,
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
    return countCenterObjectPoints(
      this.state.tilePlacesStats,
      object,
      object.isGarden ? ObjectTypes.GARDEN : ObjectTypes.MONASTERY
    )
  }
}
