import { riverTiles } from '../data/riverTiles'
import { GameSimulatorModule } from './GameSimulatorModule'
import { cloneGameState, pickGameState } from './gameState'
import {
  findTileSideConflicts,
  getPrecisionCoordinates,
  isOppositePoint,
  neighborCoordinates,
  NEIGHBOR_SIDES,
} from './gameGeometry'
import { applyQuarterTurns } from './tileRotation'
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
  ExpansionName,
  FollowerType as FollowerTypes,
  RotationDirection as RotationDirections,
  RotationTurns,
  SideName,
  TileId,
  TileSideType,
  type AvailableFollowerPlace,
  type AvailablePlace,
  type BaseObject,
  type CompletedObjects,
  type FollowerCount,
  type FollowerType,
  type GridTile,
  type GameRules,
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

export type { AvailableFollowerPlace, RotationDirection } from './types'

import type { GameAction, NewGameAction } from './gameActions'

/**
 * Контракты игровой доски: сохранённое состояние (`IGameState`) плюс команды,
 * которыми пользуются транспорт, лобби и симулятор ИИ.
 *
 * Сами правила живут в классе `GameManager` и его помощниках
 * (`GameObjectManager`, `FollowerManager`, `GameTileManager`,
 * `DragonPrincessManager`), а чистые расчёты — в `scoring.ts`.
 *
 * Методы определены в интерфейсе, потому что состояние уходит в сохранения и в
 * клиент через Socket.IO: восстановленная из сохранения партия должна вести
 * себя так же, как живая.
 */

/** Команды транспортного слоя: изменяют состояние партии. */
export interface IGameCommands {
  moveDragon(rowIndex: number, tileIndex: number): boolean
  choosePrincessFollower(cityId: string, point: Point): boolean
  startGame(): void
  placeFollower(
    availablePlace: AvailableFollowerPlace,
    followerType?: FollowerType
  ): void
  skipFollower(): void
  recallAbbot(): boolean
  placeTile(tile: Tile, rowIndex: number, tileIndex: number): boolean
}

/** API симулятора ИИ: пробные ходы и копии состояния. */
export interface IGameSimulationApi {
  autoPlaceTile(): Promise<void>
  cloneForSimulation(): IGameBoard
  simulatePlaceTile(tile: Tile, rowIndex: number, tileIndex: number): boolean
  simulatePlaceFollower(
    place: AvailableFollowerPlace,
    followerType?: FollowerType
  ): boolean
  getTileFeatureGroups(
    tile: Tile,
    feature: typeof TileSideType.City | typeof TileSideType.Road
  ): SideName[][]
}

/** Структурированные причины отказа размещения, без пользовательских текстов. */
export interface IGamePlacementDiagnostics {
  getPlacementConflicts(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): PlacementConflict[]
}

export interface IGameBoard
  extends
    IGameState,
    IGameCommands,
    IGameSimulationApi,
    IGamePlacementDiagnostics {
  calcScoreForCity(city: BaseObject, isCompleted?: boolean): ScoreForObject
  calcScoreForRoad(road: BaseObject, isCompleted?: boolean): ScoreForObject
  describeScoreForCity(city: BaseObject, isCompleted?: boolean): ScoreDetails
  describeScoreForRoad(road: BaseObject, isCompleted?: boolean): ScoreDetails
  getNextPlayer(currentPlayerId: PlayerId | undefined): Player
  clone(): IGameBoard
  copyStateFrom(source: IGameState): void
}

export class GameManager implements IGameBoard {
  id?: string
  roomCode?: string
  gridSize = [30, 30]
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

  constructor(
    params: {
      players?: Player[]
      startImmediately?: boolean
      finalScoringEnabled?: boolean
      innsAndCathedralsEnabled?: boolean
      riverEnabled?: boolean
      princessAndDragonEnabled?: boolean
    } = {}
  ) {
    const players = params.players ?? []

    this.gameIsStarted = false
    this.gameIsEnded = false
    this.finalScoringEnabled = params.finalScoringEnabled ?? false
    this.rules = {
      finalScoringEnabled: params.finalScoringEnabled ?? false,
      expansions: {
        innsAndCathedrals: params.innsAndCathedralsEnabled ?? false,
        river: params.riverEnabled ?? false,
        princessAndDragon: params.princessAndDragonEnabled ?? false,
      },
    }
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

  private get objectManager(): GameObjectManager {
    return new GameObjectManager(this)
  }

  private get followerManager(): FollowerManager {
    return new FollowerManager(this)
  }

  private get tileManager(): GameTileManager {
    return new GameTileManager(
      this,
      () => this.finishGame(),
      () => this.isPlacingStartTile
    )
  }

  private get dragonManager(): DragonPrincessManager {
    return new DragonPrincessManager(this)
  }

  initTilesList() {
    this.tileManager.initializeDeck()
  }

  initPlayers(players: Player[]) {
    players.forEach((player) => {
      this.players.push(player)
      this.scores[player.id] = 0
    })

    this.playersFollowers = players.reduce<Record<PlayerId, FollowerCount>>(
      (acc, player) => {
        acc[player.id] = {
          ordinaryFollowers: 7,
          ...(this.rules.expansions.innsAndCathedrals
            ? { bigFollowers: 1 }
            : {}),
          monks: 1,
        }
        return acc
      },
      {}
    )
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

  placeStartTile() {
    const centerCoordinates = {
      rowIndex: Math.floor(this.gridSize[1] / 2),
      tileIndex: Math.floor(this.gridSize[0] / 2),
    }

    const startTileId = this.rules.expansions.river ? TileId.RIVER_A : TileId.D
    const startDefinition = this.rules.expansions.river
      ? riverTiles.find(({ id }) => id === startTileId)
      : this.tilesList.find(({ id }) => id === startTileId)
    if (!startDefinition) throw new Error('Game has no starting tile')
    const startTile: Tile = { ...startDefinition, rotation: 0 }
    const startTileIndex = this.tilesList.findIndex(
      (tile) => tile.id === startTileId
    )
    if (startTileIndex >= 0) this.tilesList.splice(startTileIndex, 1)

    this.tileHistory.push(structuredClone(startTile))
    const wasPlacingStartTile = this.isPlacingStartTile
    this.isPlacingStartTile = this.rules.expansions.river
    const isPlaced = this.placeTile(
      startTile,
      centerCoordinates.rowIndex,
      centerCoordinates.tileIndex
    )
    this.isPlacingStartTile = wasPlacingStartTile
    if (!isPlaced) throw new Error('Unable to place starting tile')
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

    if (
      this.players.findIndex((player) => player.id === currentPlayer?.id) ===
      this.players.length - 1
    ) {
      this.moveCounter = this.moveCounter + 1
    }
    this.isPlacingFollower = false
    this.princessChoice = undefined
    this.princessFollowerPenalty = false

    const nextPlayer = this.getNextPlayer(currentPlayer?.id)

    this.currentPlayer = nextPlayer
    this.currentPlayerIndex = this.players.findIndex(
      (player) => player.id === nextPlayer.id
    )

    if (this.pendingDragonMovement) {
      this.pendingDragonMovement = false
      this.dragonManager.startPendingDragonMove()
    } else if (!this.dragonMove) {
      this.getRandomTileFromList()
    }
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
    if (this.gameIsEnded) return undefined
    const tileDefinition = this.tileManager.findTileDefinition(tile.id)
    if (options.simulation && !tileDefinition && !tile.id.startsWith('test')) {
      return undefined
    }
    const authoritativeTile: Tile = tileDefinition
      ? { ...tileDefinition, rotation: 0 }
      : { ...tile }
    if (!this.isExpansionTileAllowed(authoritativeTile)) return undefined
    if (this.isRiverTileRequiredAndMissing(authoritativeTile)) return undefined
    return this.applyRequestedRotation(
      tile,
      authoritativeTile,
      Boolean(tileDefinition)
    )
  }

  /** Расширение тайла должно быть включено в правила партии. */
  private isExpansionTileAllowed(tile: Tile): boolean {
    if (
      tile.expansion === ExpansionName.InnsAndCathedrals &&
      !this.rules.expansions.innsAndCathedrals
    ) {
      return false
    }
    return !(
      tile.expansion === ExpansionName.River && !this.rules.expansions.river
    )
  }

  /**
   * В партии с River, пока русло не закрыто, ход обязан продолжать реку.
   * Стартовый тайл правило не распространяется: русло начинается на нём.
   */
  private isRiverTileRequiredAndMissing(tile: Tile): boolean {
    if (!this.rules.expansions.river) return false
    if (this.isPlacingStartTile) return false
    return !tile.riverGroups?.length && !this.tileManager.hasRiverEnd()
  }

  /**
   * Поворачивает каталожный тайл на запрошенный угол. Для тайла из колоды
   * поворот применяется к определению, а для тестовых тайлов (`test*`), у
   * которых определения нет, стороны остаются как есть.
   */
  private applyRequestedRotation(
    tile: Tile,
    authoritativeTile: Tile,
    hasDefinition: boolean
  ): Tile {
    if (!hasDefinition) {
      // Тестовый тайл приходит целиком с клиента: каталога для него нет.
      return {
        ...authoritativeTile,
        hasGarden: tile.hasGarden ?? authoritativeTile.hasGarden,
      }
    }

    // Угол из клиента не доверяем: округляем до четверти оборота.
    const turnCount = 360 / 90
    const turns =
      ((Math.round(tile.rotation / 90) % turnCount) + turnCount) % turnCount

    return {
      ...applyQuarterTurns(authoritativeTile, turns),
      hasGarden: tile.hasGarden ?? authoritativeTile.hasGarden,
      // Угол сохраняется для истории и отображения: он уже нормализован.
      rotation: turns * 90,
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

    if (this.currentTile && !isStartTile) {
      this.currentTile.x = tileIndex
      this.currentTile.y = rowIndex
    }

    if (!this.tilePlacesStats[rowIndex]) {
      this.tilePlacesStats[rowIndex] = {}
    }
    this.tilePlacesStats[rowIndex][tileIndex] = {
      ...resolvedTile,
      rowIndex,
      tileIndex,
      x: tileIndex,
      y: rowIndex,
    }
    this.lastPlacement = { tileIndex, rowIndex }

    this.recordAction({
      actionType: ActionTypes.PLACE_TILE,
      actionData: { tile: resolvedTile, rowIndex, tileIndex },
      initiator: this.currentPlayer,
    })

    this.setAvailablePlacesTiles({ rowIndex, tileIndex })
    this.checkGridAfterPlacingTile(rowIndex, tileIndex)

    const expansionEnabled = this.rules.expansions.princessAndDragon
    if (!isStartTile && expansionEnabled) {
      this.dragonManager.applyTileEffects(resolvedTile, rowIndex, tileIndex)
      this.dragonManager.choosePrincessFollowerForComputer()
    }

    // Вулкан будит дракона: ход заканчивается без выставления подданного,
    // а сам дракон начнёт ходить в конце хода.
    if (!isStartTile && expansionEnabled && resolvedTile.hasVolcano) {
      this.dragonManager.handleVolcanoPlacement(rowIndex, tileIndex)
      this.currentTile = null
      this.endTurn()
      return true
    }

    // Пока принцесса не выбрала подданного, ход не переходит дальше.
    if (!isStartTile && !this.princessChoice) {
      this.checkAvailableFollowers()
    }

    if (!this.currentPlayer && !isStartTile) {
      this.endTurn()
    }

    return true
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
    for (const neighbor of NEIGHBOR_SIDES) {
      const coordinates = neighborCoordinates(rowIndex, tileIndex, neighbor)
      const alreadyOccupied = Boolean(
        this.tilePlacesStats[coordinates.rowIndex]?.[coordinates.tileIndex]
      )
      const alreadyPlanned = this.availablePlacesTiles.some(
        (place) =>
          place.rowIndex === coordinates.rowIndex &&
          place.tileIndex === coordinates.tileIndex
      )
      if (alreadyOccupied || alreadyPlanned) continue

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
            this.findObjectByPoint(
              this.temporaryObjects,
              adjacent.tileIndex,
              adjacent.rowIndex,
              side.oppositeSide
            ) ?? null
          )
        }),
      })
    }

    this.availablePlacesTiles = this.availablePlacesTiles.filter(
      (place) => place.rowIndex !== rowIndex || place.tileIndex !== tileIndex
    )
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

  findObjectByPoint(
    objects: TemporaryObjects,
    x: number,
    y: number,
    direction?: PointDirection
  ): BaseObject | undefined {
    return [
      ...objects.cities,
      ...objects.roads,
      ...objects.monasteries,
      ...objects.gardens,
    ].find((object) => {
      return object.points.some((point) => {
        return (
          point.x === x &&
          point.y === y &&
          (!direction || point.direction === direction)
        )
      })
    })
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

  checkAvailablePlacesForTile(tile: Tile): boolean {
    return this.tileManager.checkAvailablePlacesForTile(tile)
  }

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

  clone(): IGameBoard {
    return GameManager.restore(this)
  }

  /**
   * Копия для пробного хода симулятора. Колода и история в ней пустые: они не
   * влияют на оценку хода, но заметно удорожали бы копирование доски.
   */
  cloneForSimulation(): IGameBoard {
    const simulationState = cloneGameState(pickGameState(this))
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
    Object.assign(game, simulationState)
    return game
  }

  static restore(savedGame: IGameState): GameManager {
    const game = new GameManager({ startImmediately: false })
    Object.assign(game, cloneGameState(pickGameState(savedGame)))
    return game
  }

  /**
   * Откат к состоянию, снятому до хода. Приватные runtime-флаги класса сюда не
   * попадают: между снятием снимка и откатом они не меняются.
   */
  copyStateFrom(source: IGameState): void {
    Object.assign(this, cloneGameState(pickGameState(source)))
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
