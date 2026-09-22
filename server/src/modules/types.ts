export type PlayerId = string | number

export type SideName = 'north' | 'west' | 'south' | 'east'

export type TileSideType = 'field' | 'road' | 'city'

export type PointDirection = SideName | 'center'

export type PointType = TileSideType

export type RotationDirection = 'clockwise' | 'counterclockwise'

export interface Player {
  id: PlayerId
  name: string | null
  color: string | null
  score: number
  socketId: string | null
  deviceId: string | null
}

export interface Point {
  x: number
  y: number
  direction?: PointDirection
  pointType?: PointType
  rowIndex?: number
  tileIndex?: number
  precisionX?: number
  precisionY?: number
}

export interface ObjectFollower {
  playerId: PlayerId
  objectId: string
  point: Point
}

export interface PlacedFollower {
  playerId: PlayerId
  objectId: string
  point: Point
  isMonastery?: boolean
}

export interface ScoreForObject {
  total: number
  players: Partial<Record<PlayerId, number>>
  objectId?: string
}

export type Scores = Record<PlayerId, number>

export interface BaseObject {
  id: string
  points: Point[]
  followers: ObjectFollower[]
  score?: ScoreForObject
  isMonastery?: boolean
}

export interface City extends BaseObject {
  isSolidCity?: boolean
}

export type Road = BaseObject

export type Monastery = BaseObject

export interface TileSides {
  north: TileSideType
  west: TileSideType
  south: TileSideType
  east: TileSideType
}

export interface Tile {
  id: string
  imgUrl?: string
  rotation: number
  x?: number
  y?: number
  sides: TileSides
  isSolidCity?: boolean
  withShield?: boolean
  isMonastery?: boolean
}

export interface GridTile extends Tile {
  x: number
  y: number
  rowIndex?: number
  tileIndex?: number
}

export type TilePlacesStats = Record<number, Record<number, GridTile>>

export interface FollowerCount {
  ordinaryFollowers: number
  monks: number
}

export interface TemporaryObjects {
  cities: BaseObject[]
  roads: BaseObject[]
  monasteries: BaseObject[]
}

export type CompletedObjects = TemporaryObjects

export type AvailableFollowerPlace = {
  point: Point
  temporaryObject: BaseObject
}

/** Тип размещения подданного на сервере */
export type AvailablePlacementType = 'road' | 'city' | 'monastery'

/** Слот будущего тайла: координаты и примыкающие к ним объекты */
export interface AvailablePlace {
  rowIndex: number
  tileIndex: number
  objects: (BaseObject | null)[]
}

export enum ActionTypes {
  PLACE_TILE = 'PLACE_TILE',
  PLACE_FOLLOWER = 'PLACE_FOLLOWER',
  ADDING_SCORES = 'ADDING_SCORES',
  BACK_FOLLOWER = 'BACK_FOLLOWER',
}

export enum ObjectTypes {
  CITY = 'CITY',
  ROAD = 'ROAD',
  MONASTERY = 'MONASTERY',
}

export enum PlayerColors {
  coral = 1, // #FF7F50 - теплый, но не агрессивный как красный
  skyblue, // #87CEEB - мягкий синий
  lime, // #00FF00 - яркий, но не режущий глаз
  gold, // #FFD700 - альтернатива желтому
  orchid, // #DA70D6 - приятный фиолетовый
  teal, // #008080 - насыщенный бирюзовый
  salmon, // #FA8072 - мягкий розово-оранжевый
  slateblue, // #6A5ACD - глубокий сине-фиолетовый
}

export enum PlayerNames {
  Андрей = 1,
  Валентина,
  'Артем Кошкин',
  Владислав,
  Григорий,
  Дмитрий,
  Евгений,
  Екатерина,
}

export function playerColorForIndex(index: number): string {
  return PlayerColors[index + 1] ?? 'coral'
}

export function playerNameForIndex(index: number): string {
  return PlayerNames[index + 1] ?? 'Игрок'
}
