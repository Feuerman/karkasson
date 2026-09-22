export type TileSideType = 'field' | 'road' | 'city'

export type PointDirection = 'north' | 'west' | 'south' | 'east' | 'center'

export type PointType = TileSideType

export interface Point {
  x: number
  y: number
  direction?: PointDirection
  pointType?: PointType
}

export interface Follower {
  playerId: number
  point: Point
}

export interface BaseObject {
  id: string
  points: number
  followers: Follower[]
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
    north: TileSideType
    west: TileSideType
    south: TileSideType
    east: TileSideType
  }
  isSolidCity?: boolean
}

export interface Player {
  id: number
  name: string
}

export interface FollowerCount {
  ordinaryFollowers: number
  monks: number
}

export interface TemporaryObject extends BaseObject {}

export interface CompletedObjects {
  cities: City[]
  roads: Road[]
  monasteries: Monastery[]
}

export interface Scores {
  total: number
  cities: number[]
  roads: number[]
  monasteries: number[]
}
