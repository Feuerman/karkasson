/**
 * Описания состояния доски для помощников.
 *
 * Помощники (`GameObjectManager`, `FollowerManager`, `GameTileManager`,
 * `DragonPrincessManager`, финальный подсчёт) работают с доской как с
 * состоянием: им нужны поля партии и несколько команд доски. Описания этих
 * потребностей раньше объявлялись в пяти файлах, чтобы обойти циклический
 * импорт с `GameManager`.
 *
 * Здесь описания собраны в одном месте и выведены из `IGameState`: перечень
 * полей доски живёт в одном файле, а помощники получают ровно то, что им
 * нужно. Циклический импорт при этом исчезает: помощники знают только
 * состояние, а не класс партии.
 */

import type { NewGameAction } from './gameActions'
import type { IGameState } from './gameState'
import {
  TileSideType,
  type BaseObject,
  type PointDirection,
  type RotationDirection,
  type ScoreDetails,
  type ScoreForObject,
  type SideName,
  type TemporaryObjects,
  type Tile,
} from './types'

/** Команды доски, которыми пользуются помощники. */
export interface BoardCommands {
  /** Запись в историю ходов партии. */
  recordAction(action: NewGameAction): void
  /** Завершение хода текущего игрока и передача хода дальше. */
  endTurn(): void
  /** Стороны тайла, соединённые в группы: по ним находятся объекты доски. */
  getTileFeatureGroups(
    tile: Tile,
    feature: typeof TileSideType.City | typeof TileSideType.Road
  ): SideName[][]
  /** Объект доски в точке с указанной стороной. */
  findObjectByPoint(
    objects: TemporaryObjects,
    x: number,
    y: number,
    direction?: PointDirection
  ): BaseObject | undefined
}

/** Подсчёт очков объектов: чистые расчёты, одинаковые для всех помощников. */
export interface BoardScoring {
  calcScoreForRoad(road: BaseObject, isCompleted?: boolean): ScoreForObject
  calcScoreForCity(city: BaseObject, isCompleted?: boolean): ScoreForObject
  describeScoreForRoad(road: BaseObject, isCompleted?: boolean): ScoreDetails
  describeScoreForCity(city: BaseObject, isCompleted?: boolean): ScoreDetails
}

/** Доска для менеджера объектов. */
export type ObjectBoard = Pick<
  IGameState,
  | 'temporaryObjects'
  | 'completedObjects'
  | 'tilePlacesStats'
  | 'scores'
  | 'playersFollowers'
  | 'placedFollowers'
  | 'actionsHistory'
> &
  BoardCommands &
  BoardScoring

/** Доска для менеджера подданных. */
export type FollowerBoard = Pick<
  IGameState,
  | 'gameIsEnded'
  | 'currentTile'
  | 'currentPlayer'
  | 'playersFollowers'
  | 'rules'
  | 'temporaryObjects'
  | 'completedObjects'
  | 'tilePlacesStats'
  | 'availableFollowersPlaces'
  | 'isPlacingFollower'
  | 'princessFollowerPenalty'
  | 'placedFollowers'
  | 'fieldFollowers'
  | 'scores'
  | 'actionsHistory'
> &
  BoardCommands

/** Доска для менеджера дракона и принцессы. */
export type DragonBoard = Pick<
  IGameState,
  | 'players'
  | 'currentPlayer'
  | 'currentPlayerIndex'
  | 'currentTile'
  | 'temporaryObjects'
  | 'completedObjects'
  | 'playersFollowers'
  | 'placedFollowers'
  | 'tilePlacesStats'
  | 'availableFollowersPlaces'
  | 'isPlacingFollower'
  | 'dragonMove'
  | 'dragonPosition'
  | 'princessChoice'
  | 'princessFollowerPenalty'
  | 'pendingDragonMovement'
> &
  BoardCommands & {
    /** Проверка мест для подданных: выполняется в начале хода. */
    checkAvailableFollowers(): void
    /** Выдача следующего тайла из колоды. */
    getRandomTileFromList(): void
  }

/** Доска для менеджера тайлов. */
export type TileBoard = Pick<
  IGameState,
  | 'gameIsEnded'
  | 'rules'
  | 'gridSize'
  | 'tilesList'
  | 'currentTile'
  | 'tilePlacesStats'
  | 'availablePlacesTiles'
> &
  BoardCommands & {
    /** На доске ещё никто не ходил: центральный тайл можно поставить любой. */
    isEmptyGrid(): boolean
    /** Поворот тайла на четверть оборота. */
    rotateTile(tile: Tile, direction?: RotationDirection): Tile
    /** Запись тайла в историю тайлов партии. */
    updateTileHistory(tile: Tile): void
  }

/** Доска для финального подсчёта очков. */
export type ScoringBoard = Pick<
  IGameState,
  | 'temporaryObjects'
  | 'completedObjects'
  | 'tilePlacesStats'
  | 'fieldFollowers'
  | 'scores'
> &
  BoardCommands &
  BoardScoring
