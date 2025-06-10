export interface Player {
  id: string | null
  name: string | null
  color: string | null
  score: number
  socketId: string | null
  deviceId: string | null
}

export interface Point {
  x: number
  y: number
  direction: string
  pointType: string
  precisionX?: number
  precisionY?: number
}

export interface Follower {
  playerId: number
  point: Point
}

export interface ScoreForObject {
  total: number
  players: {
    [playerId: Player['id']]: number
  }
}

export interface Scores {
  [playerId: Player['id']]: number
}

export interface BaseObject {
  id: string
  points: Point[]
  followers?: { playerId: Player['id']; objectId: string; point: Point }[]
  score?: ScoreForObject
}

export interface City extends BaseObject {
  isSolidCity?: boolean
}

export interface Road extends BaseObject {}

export interface Monastery extends BaseObject {}

export interface Tile {
  id: string
  imgUrl: string
  rotation: number
  x?: number
  y?: number
  sides: {
    north: string
    west: string
    south: string
    east: string
  }
  isSolidCity?: boolean
}

export interface FollowerCount {
  ordinaryFollowers: number
  monks: number
}

export enum PlayerColors {
  'coral' = 1, // #FF7F50 - теплый, но не агрессивный как красный
  'skyblue', // #87CEEB - мягкий синий
  'lime', // #00FF00 - яркий, но не режущий глаз
  'gold', // #FFD700 - альтернатива желтому
  'orchid', // #DA70D6 - приятный фиолетовый
  'teal', // #008080 - насыщенный бирюзовый
  'salmon', // #FA8072 - мягкий розово-оранжевый
  'slateblue', // #6A5ACD - глубокий сине-фиолетовый
}

export enum PlayerNames {
  'Андрей' = 1,
  'Валентина',
  'Артем Кошкин',
  'Владислав',
  'Григорий',
  'Дмитрий',
  'Евгений',
  'Екатерина',
}
