/**
 * Формы записей истории ходов.
 *
 * Типы живут отдельно от `GameManager`, чтобы сам класс партии не занимался
 * описанием протокола истории: он только записывает действия через
 * `recordAction`. Клиент читает эти же типы напрямую.
 */

import {
  ActionTypes,
  ObjectTypes,
  type AvailableFollowerPlace,
  type BaseObject,
  type DragonPosition,
  type FollowerType,
  type Player,
  type ReturnedFollower,
  type ScoreDetailLine,
  type ScoreForObject,
  type Tile,
} from './types'

export interface PlaceTileActionData {
  tile: Tile
  rowIndex: number
  tileIndex: number
}

export interface PlaceFollowerActionData extends AvailableFollowerPlace {
  followerType?: FollowerType
}

/**
 * Строка детализации расчёта очков объекта: из чего сложилась сумма.
 * Формируется сервером, клиент только отображает.
 */
export interface AddingScoresActionData {
  objectType: ObjectTypes
  objectData: BaseObject
  score: ScoreForObject
  /** Строки расчёта очков. Не заполняется для сохранений старых версий. */
  details?: ScoreDetailLine[]
  /** Текстовые бонусы, повлиявшие на расчёт: таверна, собор. */
  modifiers?: string[]
  /**
   * Начисление сделано по итогам партии, а не в её ходе: недозавершённые
   * дороги, города, монастыри и сады. Не заполняется для сохранений старых версий.
   */
  isFinalScoring?: boolean
}

export interface BackFollowerActionData {
  followers: ReturnedFollower[]
}

/**
 * Шаг дракона: откуда и куда он перешёл и каких подданных съел на клетке
 * назначения. Съеденные подданные возвращаются в пул владельца и сразу после
 * шага записываются отдельной записью о возврате.
 */
export interface DragonMoveActionData {
  from: DragonPosition
  to: DragonPosition
  eatenFollowers: ReturnedFollower[]
  /** Шагов осталось после перемещения. */
  remainingSteps: number
}

/**
 * Действие принцессы: у города на её тайле выбран подданный, которого она
 * забирает. Фишка возвращается владельцу и сразу после этого записывается
 * отдельной записью о возврате.
 */
export interface PrincessTakeFollowerActionData {
  /** Город, у которого забрали подданного. */
  cityId: string
  takenFollower: ReturnedFollower
}

/** Общая часть любой записи истории ходов. */
export interface GameActionBase {
  /** Игрок, которому принадлежит действие. Не заполняется для части действий. */
  initiator?: Player | null
  /**
   * Номер хода (счётчик раундов), на который приходится действие. Группирует
   * записи истории по ходам в интерфейсе. Не заполняется для сохранений старых
   * версий, поэтому история таких партий показывается одним блоком.
   */
  moveNumber?: number
}

/**
 * Действия, снимающие фишку с поля, всегда дополняются записью о возврате
 * подданных владельцам — так история показывает, куда делась фишка.
 */
export type GameAction =
  | (GameActionBase & {
      actionType: ActionTypes.PLACE_TILE
      actionData: PlaceTileActionData
    })
  | (GameActionBase & {
      actionType: ActionTypes.PLACE_FOLLOWER
      actionData: PlaceFollowerActionData
    })
  | (GameActionBase & {
      actionType: ActionTypes.ADDING_SCORES
      actionData: AddingScoresActionData
    })
  | (GameActionBase & {
      actionType: ActionTypes.BACK_FOLLOWER
      actionData: BackFollowerActionData
    })
  | (GameActionBase & {
      actionType: ActionTypes.DRAGON_MOVE
      actionData: DragonMoveActionData
    })
  | (GameActionBase & {
      actionType: ActionTypes.PRINCESS_TAKE_FOLLOWER
      actionData: PrincessTakeFollowerActionData
    })

/** Запись истории до простановки номера хода: `moveNumber` проставляет сервер. */
export type NewGameAction = DistributiveOmit<GameAction, 'moveNumber'>

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never
