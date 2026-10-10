/**
 * Расширение «Принцесса и дракон».
 *
 * Здесь живут две связанные механики, которые включаются правилом партии:
 * дракон, просыпающийся на вулкане, и принцесса, забирающая подданного с
 * города на своём тайле. Обе работают как отдельные фазы хода: обычная
 * выкладка подданных приостанавливается, пока фаза не разрешена.
 *
 * Дракон делает до шести шагов, по одному за ход игрока, начиная с игрока,
 * который поставил вулкан. Клетки не посещаются повторно, а подданные на
 * клетке назначения съедаются и возвращаются в пул владельца. После шага
 * ход продолжается у игрока, следующего за тем, кто поставил вулкан.
 */

import { neighborCoordinates, NEIGHBOR_SIDES } from './gameGeometry'
import type { NewGameAction } from './gameActions'
import {
  ActionTypes,
  ObjectTypes,
  type AvailableFollowerPlace,
  type BaseObject,
  type DragonMoveState,
  type DragonPosition,
  type FollowerCount,
  type GridTile,
  type Player,
  type PlayerId,
  type PlacedFollower,
  type Point,
  type PrincessChoiceState,
  type ReturnedFollower,
  type TemporaryObjects,
  type Tile,
  type TilePlacesStats,
} from './types'

/** Сколько шагов делает дракон за одно пробуждение. */
const DRAGON_TOTAL_STEPS = 6

interface DragonState {
  players: Player[]
  currentPlayer: Player | null
  currentPlayerIndex: number
  currentTile: GridTile | null
  temporaryObjects: TemporaryObjects
  completedObjects: TemporaryObjects
  playersFollowers: Record<PlayerId, FollowerCount>
  placedFollowers: PlacedFollower[]
  tilePlacesStats: TilePlacesStats
  availableFollowersPlaces: AvailableFollowerPlace[]
  isPlacingFollower: boolean
  dragonMove?: DragonMoveState
  dragonPosition?: DragonPosition
  princessChoice?: PrincessChoiceState
  /** Флаг перехода: вулкан поставлен, дракон начнёт ход в конце хода игрока. */
  pendingDragonMovement: boolean
  recordAction(action: NewGameAction): void
  checkAvailableFollowers(): void
  getRandomTileFromList(): void
}

/** Пары «коллекция объектов — тип объекта» для снятия подданного с поля. */
const FOLLOWER_COLLECTIONS: ReadonlyArray<
  readonly [keyof TemporaryObjects, ObjectTypes]
> = [
  ['cities', ObjectTypes.CITY],
  ['roads', ObjectTypes.ROAD],
  ['monasteries', ObjectTypes.MONASTERY],
  ['gardens', ObjectTypes.GARDEN],
]

/**
 * Сравнение двух подданных одного игрока: совпадение игрока и клетки плюс
 * типа фишки. Идентификатор объекта не учитывается: при слиянии дорог и
 * городов объект меняется, а фишка остаётся той же.
 */
function isSameFollowerPoint(
  placed: PlacedFollower | BaseObject['followers'][number],
  follower: PlacedFollower | BaseObject['followers'][number]
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

/** Owns dragon movement, princess choice and removal of followers they take. */
export class DragonPrincessManager {
  constructor(private readonly state: DragonState) {}

  /**
   * Эффекты тайла расширения: принцесса готовит выбор подданного, дракон —
   * отложенный ход. Вызывается сразу после постановки тайла на доску.
   */
  applyTileEffects(tile: Tile, rowIndex: number, tileIndex: number) {
    if (tile.hasPrincess) {
      const adjacentCities = this.findCitiesOnPrincessTile(rowIndex, tileIndex)
      if (adjacentCities.length) {
        this.state.princessChoice = {
          followers: adjacentCities.flatMap((city) =>
            city.followers.map((follower) => ({
              cityId: city.id,
              point: follower.point,
            }))
          ),
        }
      }
    }

    if (tile.hasDragon && this.state.dragonPosition) {
      this.state.pendingDragonMovement = true
    }
  }

  /**
   * Вулкан разбудил дракона: фишку выставлять уже нельзя, ход сразу
   * заканчивается. Возвращает `true`, если ход нужно завершить.
   */
  handleVolcanoPlacement(rowIndex: number, tileIndex: number): boolean {
    this.state.dragonPosition = { rowIndex, tileIndex }
    this.state.dragonMove = undefined
    this.state.princessChoice = undefined
    this.state.currentTile = null
    this.clearFollowerPlacement()
    return true
  }

  /**
   * Принцесса выбирает подданного сама, если ход делает бот: у игрока без
   * сокета нет способа ответить. Берётся первый доступный подданный.
   */
  choosePrincessFollowerForComputer(): void {
    const choice = this.state.princessChoice
    if (!choice) return
    if (this.state.currentPlayer?.socketId) return

    const follower = choice.followers[0]
    if (follower) {
      this.choosePrincessFollower(follower.cityId, follower.point)
    }
  }

  /** Принцесса забирает выбранного подданного с города. */
  choosePrincessFollower(cityId: string, point: Point): boolean {
    const choice = this.state.princessChoice
    if (!choice) return false
    const city = this.state.temporaryObjects.cities.find(
      ({ id }) => id === cityId
    )
    if (!city) return false

    const selectedFollower = choice.followers.find(
      (candidate) =>
        candidate.cityId === cityId &&
        candidate.point.x === point.x &&
        candidate.point.y === point.y &&
        candidate.point.direction === point.direction
    )
    if (!selectedFollower) return false

    const follower = this.state.placedFollowers.find(
      (placed) =>
        placed.objectId === city.id &&
        placed.point.x === selectedFollower.point.x &&
        placed.point.y === selectedFollower.point.y &&
        placed.point.direction === selectedFollower.point.direction
    )
    if (!follower) return false

    const takenFollower = this.removeFollowerFromBoard(follower)
    if (!takenFollower) return false

    this.state.recordAction({
      actionType: ActionTypes.PRINCESS_TAKE_FOLLOWER,
      actionData: { cityId: city.id, takenFollower },
      initiator: this.state.currentPlayer,
    })
    this.recordBackFollowers([takenFollower])
    this.state.princessChoice = undefined
    return true
  }

  /**
   * Шаг дракона в соседнюю клетку: проверяется очередь, шаг в одну клетку,
   * клетка ещё не посещена. Подданные на клетке съедаются.
   */
  moveDragon(rowIndex: number, tileIndex: number): boolean {
    const move = this.state.dragonMove
    if (!move || !Number.isInteger(rowIndex) || !Number.isInteger(tileIndex)) {
      return false
    }
    if (this.state.currentPlayerIndex !== move.nextPlayerIndex) return false

    const currentPosition = this.findDragonPosition()
    if (!currentPosition) return false
    if (!this.isAdjacentDragonStep(currentPosition, rowIndex, tileIndex)) {
      return false
    }
    if (!this.state.tilePlacesStats[rowIndex]?.[tileIndex]) return false

    this.state.dragonPosition = { rowIndex, tileIndex }

    const eatenFollowers: ReturnedFollower[] = []
    for (const follower of this.state.placedFollowers.filter(
      (placed) => placed.point.x === tileIndex && placed.point.y === rowIndex
    )) {
      const eaten = this.removeFollowerFromBoard(follower)
      if (eaten) eatenFollowers.push(eaten)
    }

    move.visited.push({ rowIndex, tileIndex })
    move.remainingSteps -= 1
    this.state.recordAction({
      actionType: ActionTypes.DRAGON_MOVE,
      actionData: {
        from: {
          rowIndex: currentPosition.rowIndex,
          tileIndex: currentPosition.tileIndex,
        },
        to: { rowIndex, tileIndex },
        eatenFollowers,
        remainingSteps: Math.max(move.remainingSteps, 0),
      },
      initiator: this.state.currentPlayer,
    })
    this.recordBackFollowers(eatenFollowers)

    // Очередь дракона переходит к следующему игроку, а не остаётся у того,
    // кто только что сходил.
    move.nextPlayerIndex = this.state.players.length
      ? (move.nextPlayerIndex + 1) % this.state.players.length
      : 0
    this.state.currentPlayerIndex = move.nextPlayerIndex
    this.state.currentPlayer =
      this.state.players[this.state.currentPlayerIndex] ?? null

    if (move.remainingSteps <= 0) {
      this.finishDragonMove()
    } else {
      this.advanceDragonMove()
    }
    return true
  }

  /**
   * Запуск отложенного хода дракона. Вызывается в конце хода игрока,
   * поставившего вулкан: дракон ходит раньше остальных, а когда закончит,
   * очередь вернётся к игроку, следующему за ним.
   */
  startPendingDragonMove() {
    const position = this.findDragonPosition()
    if (!position) {
      this.state.getRandomTileFromList()
      return
    }

    this.state.dragonMove = {
      remainingSteps: DRAGON_TOTAL_STEPS,
      nextPlayerIndex: this.previousPlayerIndex(),
      resumePlayerIndex: this.state.currentPlayerIndex,
      visited: [{ ...position }],
    }
    this.advanceDragonMove()
  }

  /** Первый доступный шаг дракона: им играет бот. */
  getAutomaticDragonDestination(): DragonPosition | undefined {
    const currentPosition = this.state.dragonMove?.visited.at(-1)
    return currentPosition
      ? this.getDragonDestinations(currentPosition)[0]
      : undefined
  }

  /** Свободные соседние клетки, в которых дракон ещё не был. */
  private getDragonDestinations(position: DragonPosition): DragonPosition[] {
    const move = this.state.dragonMove
    if (!move) return []

    return NEIGHBOR_SIDES.map((neighbor) =>
      neighborCoordinates(position.rowIndex, position.tileIndex, neighbor)
    ).filter((destination) => {
      const isPlaced = Boolean(
        this.state.tilePlacesStats[destination.rowIndex]?.[
          destination.tileIndex
        ]
      )
      const wasVisited = move.visited.some(
        (visited) =>
          visited.rowIndex === destination.rowIndex &&
          visited.tileIndex === destination.tileIndex
      )
      return isPlaced && !wasVisited
    })
  }

  /** Индекс игрока перед текущим: с него начинается движение дракона. */
  private previousPlayerIndex(): number {
    const { players, currentPlayerIndex } = this.state
    if (!players.length) return 0
    return (currentPlayerIndex - 1 + players.length) % players.length
  }

  /**
   * Передаёт очередь dragonMove игроку, которому сейчас принадлежит ход.
   * Если за него ходит сервер (у игрока нет сокета), делается первый свободный
   * шаг; иначе ждём команду `moveDragon` от этого игрока.
   */
  private advanceDragonMove() {
    const move = this.state.dragonMove
    if (!move) return

    const currentPosition = move.visited[move.visited.length - 1]
    const validDestinations = currentPosition
      ? this.getDragonDestinations(currentPosition)
      : []
    if (!validDestinations.length) {
      this.finishDragonMove()
      return
    }

    this.state.currentPlayerIndex = move.nextPlayerIndex
    this.state.currentPlayer =
      this.state.players[this.state.currentPlayerIndex] ?? null

    if (this.state.currentPlayer && !this.state.currentPlayer.socketId) {
      const destination = validDestinations[0]
      if (destination) {
        this.moveDragon(destination.rowIndex, destination.tileIndex)
      }
    }
  }

  private finishDragonMove() {
    const move = this.state.dragonMove
    this.state.dragonMove = undefined
    this.clearFollowerPlacement()

    if (move && this.state.players.length) {
      this.state.currentPlayerIndex = move.resumePlayerIndex
      this.state.currentPlayer =
        this.state.players[move.resumePlayerIndex] ?? null
    }
    this.state.getRandomTileFromList()
  }

  private clearFollowerPlacement() {
    this.state.isPlacingFollower = false
    this.state.availableFollowersPlaces = []
  }

  private isAdjacentDragonStep(
    position: DragonPosition,
    rowIndex: number,
    tileIndex: number
  ): boolean {
    const distance =
      Math.abs(position.rowIndex - rowIndex) +
      Math.abs(position.tileIndex - tileIndex)
    const wasVisited = this.state.dragonMove?.visited.some(
      (visited) =>
        visited.rowIndex === rowIndex && visited.tileIndex === tileIndex
    )
    return distance === 1 && !wasVisited
  }

  /** Положение дракона: явное или по вулкану на доске. */
  private findDragonPosition(): DragonPosition | undefined {
    if (this.state.dragonPosition) return this.state.dragonPosition

    for (const [row, tiles] of Object.entries(this.state.tilePlacesStats)) {
      for (const [column, tile] of Object.entries(tiles)) {
        if (tile.hasVolcano) {
          this.state.dragonPosition = {
            rowIndex: Number(row),
            tileIndex: Number(column),
          }
          return this.state.dragonPosition
        }
      }
    }
    return undefined
  }

  private findCitiesOnPrincessTile(rowIndex: number, tileIndex: number) {
    return this.state.temporaryObjects.cities.filter(
      (city) =>
        city.followers.length > 0 &&
        city.points.some(
          (point) => point.x === tileIndex && point.y === rowIndex
        )
    )
  }

  /**
   * Снимает подданного с поля и возвращает его в пул владельца.
   * Возвращает описание фишки для истории или `undefined`, если её не было.
   * Запись о возврате вызывающий код делает сам — так, чтобы она шла в
   * истории сразу после записи о действии, которое сняло фишку.
   */
  private removeFollowerFromBoard(
    follower: PlacedFollower | undefined
  ): ReturnedFollower | undefined {
    if (!follower) return undefined

    let objectType: ObjectTypes | undefined
    for (const [collection, type] of FOLLOWER_COLLECTIONS) {
      for (const objects of [
        this.state.temporaryObjects[collection],
        this.state.completedObjects[collection],
      ]) {
        const object = objects.find(({ id }) => id === follower.objectId)
        if (!object) continue
        objectType ??= type
        object.followers = object.followers.filter(
          (placed) => !isSameFollowerPoint(placed, follower)
        )
      }
    }

    const pool = this.state.playersFollowers[follower.playerId]
    if (pool) {
      if (follower.isAbbot) pool.monks += 1
      else if (follower.isBigFollower) {
        pool.bigFollowers = (pool.bigFollowers ?? 0) + 1
      } else pool.ordinaryFollowers += 1
    }
    this.state.placedFollowers = this.state.placedFollowers.filter(
      (placed) => placed !== follower
    )

    return {
      playerId: follower.playerId,
      objectId: follower.objectId,
      point: follower.point,
      isAbbot: follower.isAbbot,
      isBigFollower: follower.isBigFollower,
      objectType,
    }
  }

  /** Запись истории о возврате подданных владельцам. */
  private recordBackFollowers(followers: ReturnedFollower[]) {
    if (!followers.length) return
    this.state.recordAction({
      actionType: ActionTypes.BACK_FOLLOWER,
      actionData: { followers },
    })
  }
}
