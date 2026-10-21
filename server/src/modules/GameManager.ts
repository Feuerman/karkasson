import { GameSimulatorModule } from './GameSimulatorModule'
import {
  cloneGameState,
  cloneRollbackState,
  pickGameState,
  pickRollbackState,
} from './gameState'
import {
  boardCenterCoordinates,
  findTileSideConflicts,
  getPrecisionCoordinates,
  isOppositePoint,
  neighborCoordinates,
  NEIGHBOR_SIDES,
} from './gameGeometry'
import { applyQuarterTurns } from './tileRotation'
import {
  resolvePlacementTile,
  type TilePlacementContext,
} from './tilePlacement'
import { resolveTileFeatureGroups } from './tileFeatureGroups'
import { GameObjectManager } from './GameObjectManager'
import { FollowerManager } from './FollowerManager'
import { GameTileManager } from './GameTileManager'
import { DragonPrincessManager } from './DragonPrincessManager'
import { finalizeScoring } from './finalScoring'
import type { IGameState } from './gameState'
import {
  calcCityScore,
  calcRoadScore,
  describeCityScore,
  describeRoadScore,
  leaderPlayerIds,
} from './scoring'
import {
  ActionTypes,
  BOARD_GRID_SIZE,
  ExpansionName,
  FollowerType as FollowerTypes,
  RotationDirection as RotationDirections,
  RotationTurns,
  SideName,
  TileSideType,
  type AbbotRecallInfo,
  type AvailableFollowerPlace,
  type AvailablePlace,
  type BaseObject,
  type CompletedObjects,
  type FollowerCount,
  type FollowerType,
  type GameOptions,
  type GameRules,
  type GridTile,
  type DragonMoveState,
  type PrincessChoiceState,
  type DragonPosition,
  type Player,
  type PlayerId,
  type PlacedFollower,
  type PlacementConflict,
  type Point,
  type PointDirection,
  type RotationDirection,
  type ScoreDetails,
  type ScoreForObject,
  type Scores,
  type TemporaryObjects,
  type Tile,
  type TilePlacesStats,
} from './types'
import { rulesFromOptions } from './types'

export type { AvailableFollowerPlace, RotationDirection } from './types'

import type { GameAction, NewGameAction } from './gameActions'

/** Ключ клетки доски: координаты в виде строки. */
function placeKey(rowIndex: number, tileIndex: number): string {
  return `${rowIndex}:${tileIndex}`
}

/** Ключ точки объекта доски: координаты и сторона. */
function objectKey(
  x: number,
  y: number,
  direction: PointDirection | undefined
): string {
  return `${x}:${y}:${direction ?? ''}`
}

/** Созданные один раз помощники партии. */
interface ManagerCache {
  objectManager?: GameObjectManager
  followerManager?: FollowerManager
  tileManager?: GameTileManager
  dragonManager?: DragonPrincessManager
}

/**
 * Партия: сохранённое состояние (`IGameState`) плюс команды, которыми
 * пользуются транспорт, лобби и симулятор ИИ.
 *
 * Сами правила живут в классе и его помощниках (`GameObjectManager`,
 * `FollowerManager`, `GameTileManager`, `DragonPrincessManager`), а чистые
 * расчёты — в `scoring.ts`.
 *
 * Класс — единственный контракт слоя: состояние уходит в сохранения и в
 * клиент через Socket.IO, поэтому восстановленная из сохранения партия должна
 * вести себя так же, как живая.
 */
export class GameManager implements IGameState {
  id?: string
  roomCode?: string
  gridSize: number[] = [...BOARD_GRID_SIZE]
  gameIsStarted: boolean
  gameIsEnded: boolean
  finalScoringEnabled: boolean
  rules: GameRules
  tilesList: Tile[]
  currentTile: GridTile | null
  players: Player[]
  currentPlayer: Player | null
  currentPlayerIndex: number
  playersFollowers: Record<PlayerId, FollowerCount>
  temporaryObjects: TemporaryObjects
  completedObjects: CompletedObjects
  scores: Scores
  winnerPlayerIds: PlayerId[] = []
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
  dragonMove?: DragonMoveState
  princessChoice?: PrincessChoiceState
  princessFollowerPenalty = false
  dragonPosition?: DragonPosition
  pendingDragonMovement = false
  private isPlacingStartTile = false
  /**
   * Клетки, которые можно занять следующим тайлом. Хранятся рядом со списком
   * клеток, чтобы проверка «уже запланировано» не перебирала весь список.
   */
  private availablePlacesKeys = new Set<string>()

  constructor(
    params: {
      players?: Player[]
      startImmediately?: boolean
    } & GameOptions = {}
  ) {
    const players = params.players ?? []

    // Помощники ссылаются на партию, поэтому их кэш не перечисляется: иначе
    // состояние перестало бы быть обычным JSON.
    Object.defineProperty(this, 'managers', { enumerable: false })

    this.gameIsStarted = false
    this.gameIsEnded = false
    this.rules = rulesFromOptions(params)
    this.finalScoringEnabled = params.finalScoringEnabled ?? false
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
    this.winnerPlayerIds = []
    this.playersFollowers = {}
    this.placedFollowers = []
    this.moveCounter = 1
    this.lastPlacement = { rowIndex: undefined, tileIndex: undefined }
    this.availablePlacesTiles = []
    this.tileHistory = []
    this.actionsHistory = []
    this.princessChoice = undefined

    this.initTilesList()
    this.initPlayers(players)

    if (params.startImmediately !== false) this.startGame()
  }

  /**
   * Помощники создаются один раз и держатся в скрытом поле: раньше они
   * создавались заново на каждое обращение, хотя состояние доски у них одно
   * и то же. Поле не перечисляется — помощники ссылаются на партию, и без
   * этого состояние перестало бы быть обычным JSON.
   */
  private readonly managers: ManagerCache = {}

  private get objectManager(): GameObjectManager {
    if (!this.managers.objectManager) {
      this.managers.objectManager = new GameObjectManager(this)
    }
    return this.managers.objectManager
  }

  private get followerManager(): FollowerManager {
    if (!this.managers.followerManager) {
      this.managers.followerManager = new FollowerManager(this)
    }
    return this.managers.followerManager
  }

  private get tileManager(): GameTileManager {
    if (!this.managers.tileManager) {
      this.managers.tileManager = new GameTileManager(
        this,
        () => this.finishGame(),
        () => this.isPlacingStartTile
      )
    }
    return this.managers.tileManager
  }

  private get dragonManager(): DragonPrincessManager {
    if (!this.managers.dragonManager) {
      this.managers.dragonManager = new DragonPrincessManager(this)
    }
    return this.managers.dragonManager
  }

  initTilesList() {
    this.tileManager.initializeDeck()
  }

  initPlayers(players: Player[]) {
    for (const player of players) {
      this.players.push(player)
      this.scores[player.id] = 0
      this.playersFollowers[player.id] = {
        ordinaryFollowers: 7,
        ...(this.rules.expansions.innsAndCathedrals ? { bigFollowers: 1 } : {}),
        monks: 1,
      }
    }
  }

  startGame() {
    this.gameIsStarted = true
    if (this.rules.expansions.river) {
      this.currentPlayer = this.players[0] ?? null
      this.currentPlayerIndex = 0
    }
    this.isPlacingStartTile = true
    this.placeStartTile()
    this.isPlacingStartTile = false
    if (this.rules.expansions.river) this.getRandomTileFromList()
    if (!this.rules.expansions.river) {
      this.currentPlayer = this.players[0] ?? null
      this.currentPlayerIndex = 0
    }
  }

  /**
   * Ставит стартовый тайл в центр доски и убирает его копию из колоды.
   *
   * В River стартовый тайл открывает русло, поэтому на время постановки
   * включается режим старта: правила реки и обязательное продолжение русла к
   * нему не применяются. В базовой игре режим старта, наоборот, снимается:
   * `placeTile` должен доиграть фиктивный ход и раздать первый тайл, который
   * в River выдаёт уже `startGame`.
   */
  private placeStartTile() {
    const center = boardCenterCoordinates(this.gridSize)
    const startTile = this.tileManager.takeStartTile()
    this.updateTileHistory(startTile)

    const wasPlacingStartTile = this.isPlacingStartTile
    this.isPlacingStartTile = this.rules.expansions.river
    try {
      const isPlaced = this.placeTile(
        startTile,
        center.rowIndex,
        center.tileIndex
      )
      if (!isPlaced) throw new Error('Unable to place starting tile')
    } finally {
      this.isPlacingStartTile = wasPlacingStartTile
    }
  }

  /**
   * Единственная точка добавления записи в историю: проставляет номер хода,
   * чтобы группировка по ходам в интерфейсе не расходилась между видами действий.
   */
  recordAction(action: NewGameAction) {
    this.actionsHistory.push({ ...action, moveNumber: this.moveCounter })
  }

  /**
   * Завершает ход текущего игрока и передаёт ход следующему. Если в этом ходу
   * проснулся дракон, его движение разворачивается раньше остальных игроков;
   * иначе выдаётся следующий тайл.
   */
  endTurn() {
    const currentPlayer = this.currentPlayer

    if (this.indexOfPlayer(currentPlayer?.id) === this.players.length - 1) {
      this.moveCounter = this.moveCounter + 1
    }
    this.isPlacingFollower = false
    this.princessChoice = undefined
    this.princessFollowerPenalty = false

    const nextPlayer = this.getNextPlayer(currentPlayer?.id)

    this.currentPlayer = nextPlayer
    // В партии без игроков следующего игрока нет: индекс остаётся пустым,
    // как и раньше, когда поиск по пустому списку ничего не вычислял.
    this.currentPlayerIndex = nextPlayer
      ? this.indexOfPlayer(nextPlayer.id)
      : -1

    if (this.pendingDragonMovement) {
      this.pendingDragonMovement = false
      this.dragonManager.startPendingDragonMove()
    } else if (!this.dragonMove) {
      this.getRandomTileFromList()
    }
  }

  /** Индекс игрока в списке партии; `-1`, если игрока нет. */
  private indexOfPlayer(playerId: PlayerId | undefined): number {
    return this.players.findIndex((player) => player.id === playerId)
  }

  /** Игрок по индексу в списке партии. */
  private playerAt(index: number): Player {
    return this.players[index]
  }

  getNextPlayer(currentPlayerId: PlayerId | undefined): Player {
    const currentPlayerIndex = this.indexOfPlayer(currentPlayerId)

    if (currentPlayerIndex === -1) {
      return this.playerAt(0)
    }

    return this.playerAt(
      currentPlayerIndex === this.players.length - 1
        ? 0
        : currentPlayerIndex + 1
    )
  }

  checkAvailableFollowers() {
    this.followerManager.checkAvailableFollowers()
  }

  findAvailableFollowersPlaces(tile: GridTile): AvailableFollowerPlace[] {
    return this.followerManager.findAvailableFollowersPlaces(tile)
  }

  /**
   * Серверный источник истины для присланного тайла: стороны и группы берутся
   * из каталога, а из клиентского объекта допускается только поворот (и флаг
   * сада для тестовых тайлов). Возвращает `undefined`, если тайл нельзя играть
   * при действующих расширениях.
   */
  private resolvePlacementTile(
    tile: Tile,
    options: { simulation?: boolean } = {}
  ): Tile | undefined {
    return resolvePlacementTile(tile, this.placementContext(), options)
  }

  /** Сведения о партии, нужные для разрешения тайла. */
  private placementContext(): TilePlacementContext {
    return {
      rules: this.rules,
      gameIsEnded: this.gameIsEnded,
      isPlacingStartTile: this.isPlacingStartTile,
      hasRiverEnd: this.tileManager.hasRiverEnd(),
    }
  }

  getPlacementConflicts(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): PlacementConflict[] {
    const resolvedTile = this.resolvePlacementTile(tile)
    if (!resolvedTile) return []
    if (this.tilePlacesStats[rowIndex]?.[tileIndex]) return []

    if (
      this.rules.expansions.river &&
      resolvedTile.expansion === ExpansionName.River
    ) {
      const riverConflict = this.tileManager.getRiverConflict(
        resolvedTile,
        rowIndex,
        tileIndex
      )
      return riverConflict ? [riverConflict] : []
    }

    if (
      this.tileManager.isCorrectTilePosition(resolvedTile, rowIndex, tileIndex)
    ) {
      return []
    }

    return findTileSideConflicts(
      resolvedTile,
      rowIndex,
      tileIndex,
      this.tilePlacesStats,
      this.isEmptyGrid()
    )
  }

  /**
   * Ставит тайл на доску и продвигает ход: обновляет объекты, применяет
   * расширения и либо предлагает выставить подданного, либо сразу передаёт ход
   * дальше. Возвращает `false`, если тайл нельзя поставить в эту клетку.
   */
  placeTile(tile: Tile, rowIndex: number, tileIndex: number): boolean {
    const resolvedTile = this.resolvePlacementTile(tile)
    if (!resolvedTile) return false
    if (
      !this.tileManager.isValidTilePlacement(resolvedTile, rowIndex, tileIndex)
    ) {
      return false
    }

    const isStartTile = this.isPlacingStartTile

    this.applyResolvedTile(resolvedTile, rowIndex, tileIndex, isStartTile)
    this.registerTilePlacement(resolvedTile, rowIndex, tileIndex)

    if (
      this.applyExpansionEffects(resolvedTile, rowIndex, tileIndex, isStartTile)
    ) {
      return true
    }

    this.advanceTurn(isStartTile)
    return true
  }

  /** Запоминает, на какой клетке выложен текущий тайл. */
  private applyResolvedTile(
    tile: Tile,
    rowIndex: number,
    tileIndex: number,
    isStartTile: boolean
  ): void {
    if (this.currentTile && !isStartTile) {
      this.currentTile.x = tileIndex
      this.currentTile.y = rowIndex
    }
  }

  /** Записывает тайл на доску, в историю и пересчитывает доступные клетки. */
  private registerTilePlacement(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): void {
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

    this.recordAction({
      actionType: ActionTypes.PLACE_TILE,
      actionData: { tile, rowIndex, tileIndex },
      initiator: this.currentPlayer,
    })

    this.setAvailablePlacesTiles({ rowIndex, tileIndex })
    this.checkGridAfterPlacingTile(rowIndex, tileIndex)
  }

  /**
   * Эффекты дополнений: принцесса выбирает подданного, вулкан будит дракона.
   * Возвращает `true`, если ход уже закончен вулканом.
   */
  private applyExpansionEffects(
    tile: Tile,
    rowIndex: number,
    tileIndex: number,
    isStartTile: boolean
  ): boolean {
    const expansionEnabled = this.rules.expansions.princessAndDragon
    if (!isStartTile && expansionEnabled) {
      this.dragonManager.applyTileEffects(tile, rowIndex, tileIndex)
      this.dragonManager.choosePrincessFollowerForComputer()
    }

    // Вулкан будит дракона: ход заканчивается без выставления подданного,
    // а сам дракон начнёт ходить в конце хода.
    if (!isStartTile && expansionEnabled && tile.hasVolcano) {
      this.dragonManager.handleVolcanoPlacement(rowIndex, tileIndex)
      this.currentTile = null
      this.endTurn()
      return true
    }

    return false
  }

  /** Передаёт ход дальше: сначала предлагает фишку, затем завершает ход. */
  private advanceTurn(isStartTile: boolean): void {
    // Пока принцесса не выбрала подданного, ход не переходит дальше.
    if (!isStartTile && !this.princessChoice) {
      this.checkAvailableFollowers()
    }

    if (!this.currentPlayer && !isStartTile) {
      this.endTurn()
    }
  }

  /**
   * Пересчитывает список клеток, куда можно положить следующий тайл:
   * добавляет свободных соседей только что поставленного тайла и убирает
   * саму занятую им клетку. Для каждого слота собираются примыкающие объекты
   * — их интерфейс подсвечивает игроку при выборе.
   */
  setAvailablePlacesTiles({
    rowIndex,
    tileIndex,
  }: {
    rowIndex: number
    tileIndex: number
  }) {
    const objectIndex = this.buildNearbyObjectIndex(rowIndex, tileIndex)

    for (const neighbor of NEIGHBOR_SIDES) {
      const coordinates = neighborCoordinates(rowIndex, tileIndex, neighbor)
      const alreadyOccupied = Boolean(
        this.tilePlacesStats[coordinates.rowIndex]?.[coordinates.tileIndex]
      )
      const key = placeKey(coordinates.rowIndex, coordinates.tileIndex)
      if (alreadyOccupied || this.availablePlacesKeys.has(key)) continue

      this.availablePlacesKeys.add(key)
      this.availablePlacesTiles.push({
        ...coordinates,
        objects: NEIGHBOR_SIDES.map((side) => {
          const adjacent = neighborCoordinates(
            coordinates.rowIndex,
            coordinates.tileIndex,
            side
          )
          if (!this.tilePlacesStats[adjacent.rowIndex]?.[adjacent.tileIndex]) {
            return null
          }
          return (
            objectIndex.get(
              objectKey(
                adjacent.tileIndex,
                adjacent.rowIndex,
                side.oppositeSide
              )
            ) ?? null
          )
        }),
      })
    }

    this.availablePlacesKeys.delete(placeKey(rowIndex, tileIndex))
    this.availablePlacesTiles = this.availablePlacesTiles.filter(
      (place) => place.rowIndex !== rowIndex || place.tileIndex !== tileIndex
    )
  }

  /**
   * Индекс объектов доски по окрестности 3×3 вокруг поставленного тайла:
   * примыкающие объекты нужны только оттуда, а искать их перебором всех
   * объектов доски для каждой соседней клетки было слишком дорого.
   */
  private buildNearbyObjectIndex(
    rowIndex: number,
    tileIndex: number
  ): Map<string, BaseObject> {
    const index = new Map<string, BaseObject>()
    const collections = [
      this.temporaryObjects.cities,
      this.temporaryObjects.roads,
      this.temporaryObjects.monasteries,
      this.temporaryObjects.gardens,
    ]
    for (const collection of collections) {
      for (const object of collection) {
        for (const point of object.points) {
          if (
            Math.abs(point.x - tileIndex) > 1 ||
            Math.abs(point.y - rowIndex) > 1
          ) {
            continue
          }
          const key = objectKey(point.x, point.y, point.direction)
          if (!index.has(key)) index.set(key, object)
        }
      }
    }
    return index
  }

  placeFollower(
    availablePlace: AvailableFollowerPlace,
    followerType: FollowerType = FollowerTypes.Follower
  ) {
    this.followerManager.placeFollower(availablePlace, followerType)
  }

  skipFollower() {
    this.followerManager.skipFollower()
  }

  /** Шаг дракона: перемещение и съедание подданных на клетке назначения. */
  moveDragon(rowIndex: number, tileIndex: number): boolean {
    return this.dragonManager.moveDragon(rowIndex, tileIndex)
  }

  choosePrincessFollower(cityId: string, point: Point): boolean {
    const chosen = this.dragonManager.choosePrincessFollower(cityId, point)
    // Принцесса забрала подданного: свободных мест могло остаться больше,
    // поэтому предлагаем текущему игроку продолжить ход.
    if (chosen && this.currentTile) this.checkAvailableFollowers()
    return chosen
  }

  /**
   * Отзыв аббата в ход владельца: аббат снимается с монастыря или сада
   * (завершённого или нет) и начисляются очки за «незавершённый» объект —
   * 1 очко за сам тайл и по 1 очку за каждую занятую клетку в окрестности 3×3.
   * Ход не расходуется: игрок после отзыва продолжает свой ход.
   */
  recallAbbot(): boolean {
    return this.followerManager.recallAbbot()
  }

  /**
   * Типы фишек, доступные активному игроку в конкретном месте.
   */
  getAvailableFollowerTypes(place: AvailableFollowerPlace): FollowerType[] {
    return this.followerManager.getAvailableFollowerTypes(place)
  }

  /**
   * Что даст отзыв аббата текущему игроку, либо `null`, если отзывать нечего.
   */
  getAbbotRecallInfo(): AbbotRecallInfo | null {
    return this.followerManager.getAbbotRecallInfo()
  }

  findObjectByPoint(
    objects: TemporaryObjects,
    x: number,
    y: number,
    direction?: PointDirection
  ): BaseObject | undefined {
    for (const collection of [
      objects.cities,
      objects.roads,
      objects.monasteries,
      objects.gardens,
    ]) {
      for (const object of collection) {
        const found = object.points.some(
          (point) =>
            point.x === x &&
            point.y === y &&
            (!direction || point.direction === direction)
        )
        if (found) return object
      }
    }
    return undefined
  }

  /**
   * Ход компьютерного игрока: если сейчас ходит дракон, делается его шаг,
   * иначе подбирается лучший ход симулятора и выполняется целиком — тайл,
   * фишка (или пропуск фишки). Если подходящих ходов нет, берётся другой тайл.
   */
  async autoPlaceTile(): Promise<void> {
    if (this.gameIsEnded) return

    if (this.dragonMove) {
      const destination = this.dragonManager.getAutomaticDragonDestination()
      if (destination)
        this.moveDragon(destination.rowIndex, destination.tileIndex)
      return
    }

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

      // Принцесса забирает подданного до выставления своей фишки.
      if (this.princessChoice) {
        this.dragonManager.choosePrincessFollowerForComputer()
        return
      }

      // Штраф принцессы: способность сработала, свою фишку на этот тайл бот
      // поставить не может.
      if (this.princessFollowerPenalty) {
        this.skipFollower()
        return
      }

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
    if (this.gameIsEnded) return
    this.tileManager.drawNextTile()
  }

  /** Партия окончена: сбрасываем ход и, если включено, считаем очки. */
  private finishGame() {
    this.gameIsEnded = true
    this.currentTile = null
    this.isPlacingFollower = false
    this.availableFollowersPlaces = []
    this.availablePlacesTiles = []
    this.currentPlayer = null
    this.tilesList = []
    if (this.finalScoringEnabled) finalizeScoring(this)
    // Победителя считаем здесь, после финального подсчёта: клиент только
    // отображает готовый список лидеров и не пересчитывает очки.
    this.winnerPlayerIds = leaderPlayerIds(this.scores)
  }

  // ---------------------------------------------------------------------------
  // Доступ к объектам доски.
  //
  // Методы ниже не содержат правил: это тонкие делегаты в
  // `GameObjectManager` и чистые функции подсчёта из `scoring.ts`. Они нужны
  // помощникам (которые получают ссылку на доску как на состояние) и
  // тестам, которые проверяют объекты и их подсчёт в изоляции от ходов.
  // ---------------------------------------------------------------------------

  updateTileHistory(tile: Tile) {
    this.tileHistory.push(structuredClone(tile))
  }

  checkGridAfterPlacingTile(rowIndex: number, tileIndex: number) {
    this.objectManager.checkGridAfterPlacingTile(rowIndex, tileIndex)
  }

  // Подсчёт очков и его детализация для истории. Расчёты чистые и не меняют
  // правила: меняется только то, какие бонусы расширения действуют.

  calcScoreForRoad(road: BaseObject, isCompleted = true): ScoreForObject {
    return calcRoadScore(
      this.tilePlacesStats,
      road,
      this.scores,
      isCompleted,
      this.rules.expansions.innsAndCathedrals,
      this.rules.expansions.innsAndCathedrals
    )
  }

  calcScoreForCity(city: BaseObject, isCompleted = true): ScoreForObject {
    return calcCityScore(
      this.tilePlacesStats,
      city,
      this.scores,
      isCompleted,
      this.rules.expansions.innsAndCathedrals,
      this.rules.expansions.innsAndCathedrals
    )
  }

  /** Описание расчёта очков дороги для истории ходов. */
  describeScoreForRoad(road: BaseObject, isCompleted = true): ScoreDetails {
    return describeRoadScore(
      this.tilePlacesStats,
      road,
      isCompleted,
      this.rules.expansions.innsAndCathedrals
    )
  }

  /** Описание расчёта очков города для истории ходов. */
  describeScoreForCity(city: BaseObject, isCompleted = true): ScoreDetails {
    return describeCityScore(
      this.tilePlacesStats,
      city,
      isCompleted,
      this.rules.expansions.innsAndCathedrals
    )
  }

  isCorrectTilePosition(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): boolean {
    return this.tileManager.isCorrectTilePosition(tile, rowIndex, tileIndex)
  }

  getTileFeatureGroups(
    tile: Tile,
    feature: typeof TileSideType.City | typeof TileSideType.Road
  ): SideName[][] {
    return resolveTileFeatureGroups(
      tile,
      this.tileManager.findTileDefinition(tile.id),
      feature
    )
  }

  isOppositePoint(point: Point, oppositePoint: Point): boolean {
    return isOppositePoint(point, oppositePoint)
  }

  getPrecisionCoordinates(point: Point): { x: number; y: number } {
    return getPrecisionCoordinates(point)
  }

  /**
   * Поворачивает тайл на четверть оборота по или против часовой стрелки.
   * Полный оборот обозначается углом 360, а не 0, чтобы угол, присланный
   * игроком, отображался в интерфейсе буквально таким, каким он пришёл.
   */
  rotateTile(
    tile: Tile,
    direction: RotationDirection = RotationDirections.Clockwise
  ): Tile {
    const isClockwise = direction === RotationDirections.Clockwise
    const quarterTurns = isClockwise
      ? RotationTurns.Quarter
      : RotationTurns.ThreeQuarter
    const rotation = isClockwise ? tile.rotation + 90 : tile.rotation - 90

    return {
      ...applyQuarterTurns(tile, quarterTurns),
      rotation:
        rotation > 360
          ? rotation - 360
          : rotation < 0
            ? rotation + 360
            : rotation,
    }
  }

  isEmptyGrid(): boolean {
    return this.lastPlacement.rowIndex === undefined
  }

  clone(): GameManager {
    return GameManager.restore(this)
  }

  /**
   * Копия для пробного хода симулятора. Колода и история в ней пустые: они не
   * влияют на оценку хода, но заметно удорожали бы копирование доски.
   */
  cloneForSimulation(): GameManager {
    const simulationState = pickGameState(this)
    // Колода и история в копии пустые: они не влияют на оценку хода, поэтому
    // отбрасываются до копирования, а не после.
    simulationState.tilesList = []
    simulationState.tileHistory = []
    simulationState.actionsHistory = []
    simulationState.completedObjects = {
      cities: [],
      roads: [],
      monasteries: [],
      gardens: [],
    }
    const game = new GameManager({ startImmediately: false })
    game.applyState(simulationState)
    return game
  }

  static restore(savedGame: IGameState): GameManager {
    const game = new GameManager({ startImmediately: false })
    game.applyState(savedGame)
    return game
  }

  /**
   * Откат к состоянию, снятому до хода. Приватные runtime-флаги класса сюда не
   * попадают: между снятием снимка и откатом они не меняются.
   */
  copyStateFrom(source: IGameState): void {
    this.applyState(source)
  }

  /**
   * Единственная точка переноса состояния в партию: снимаются только
   * сериализуемые поля, остальное остаётся runtime-состоянием класса.
   */
  private applyState(source: IGameState): void {
    Object.assign(this, cloneGameState(pickGameState(source)))
    this.syncAvailablePlacesKeys()
  }

  /**
   * Снимок для отката: изменяемая часть состояния. Колода и история тайлов
   * в снимок не входят — ход их не меняет, а копировать дороже всего.
   */
  captureRollbackState(): Partial<IGameState> {
    return cloneRollbackState(pickRollbackState(this))
  }

  /**
   * Откат к снимку, снятому до хода. Колода и история тайлов остаются как
   * были: ход их не менял.
   */
  restoreRollbackState(state: Partial<IGameState>): void {
    Object.assign(this, state)
    // Текущий игрок — тот же объект, что и в списке игроков: после отката
    // связь восстанавливается, иначе изменения игрока не попадут в список.
    const currentPlayerId = state.currentPlayer?.id
    this.currentPlayer =
      this.players.find((player) => player.id === currentPlayerId) ?? null
    this.syncAvailablePlacesKeys()
  }

  /** Пересобирает множество занятых клеток по списку доступных клеток. */
  private syncAvailablePlacesKeys(): void {
    this.availablePlacesKeys = new Set(
      this.availablePlacesTiles.map((place) =>
        placeKey(place.rowIndex, place.tileIndex)
      )
    )
  }

  /**
   * Пробный ход для симуляции ИИ. Отличия от реального `placeTile` намеренные:
   * принимаются каталожные тайлы и тестовые `test*`, запись в историю и
   * переход хода не выполняются — состояние используется только для оценки хода.
   */
  simulatePlaceTile(tile: Tile, rowIndex: number, tileIndex: number): boolean {
    const resolvedTile = this.resolvePlacementTile(tile, {
      simulation: true,
    })
    if (!resolvedTile) return false

    if (
      !this.tileManager.isValidTilePlacement(resolvedTile, rowIndex, tileIndex)
    ) {
      return false
    }

    if (!this.tilePlacesStats[rowIndex]) {
      this.tilePlacesStats[rowIndex] = {}
    }
    this.tilePlacesStats[rowIndex][tileIndex] = {
      ...resolvedTile,
      x: tileIndex,
      y: rowIndex,
    }

    this.checkGridAfterPlacingTile(rowIndex, tileIndex)
    this.availableFollowersPlaces = this.findAvailableFollowersPlaces(
      this.tilePlacesStats[rowIndex][tileIndex]
    )
    return true
  }

  simulatePlaceFollower(
    availablePlace: AvailableFollowerPlace,
    followerType: FollowerType = FollowerTypes.Follower
  ): boolean {
    return this.followerManager.simulatePlaceFollower(
      availablePlace,
      followerType
    )
  }
}

export default GameManager
