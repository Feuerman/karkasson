export type PlayerId = string | number

export const TileId = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
  F: 'F',
  G: 'G',
  H: 'H',
  I: 'I',
  J: 'J',
  K: 'K',
  L: 'L',
  M: 'M',
  N: 'N',
  O: 'O',
  P: 'P',
  Q: 'Q',
  R: 'R',
  S: 'S',
  T: 'T',
  U: 'U',
  V: 'V',
  W: 'W',
  X: 'X',
  IAC_A: 'IAC-A',
  IAC_B: 'IAC-B',
  IAC_C: 'IAC-C',
  IAC_D: 'IAC-D',
  IAC_E: 'IAC-E',
  IAC_F: 'IAC-F',
  IAC_G: 'IAC-G',
  IAC_H: 'IAC-H',
  IAC_I: 'IAC-I',
  IAC_J: 'IAC-J',
  IAC_Ka: 'IAC-Ka',
  IAC_Kb: 'IAC-Kb',
  IAC_L: 'IAC-L',
  IAC_M: 'IAC-M',
  IAC_N: 'IAC-N',
  IAC_O: 'IAC-O',
  IAC_P: 'IAC-P',
  IAC_Q: 'IAC-Q',
} as const

export type TileId = (typeof TileId)[keyof typeof TileId]

export function isTileId(value: unknown): value is TileId {
  return (
    typeof value === 'string' &&
    Object.values(TileId).some((tileId) => tileId === value)
  )
}

export const SideName = {
  North: 'north',
  West: 'west',
  South: 'south',
  East: 'east',
} as const

export type SideName = (typeof SideName)[keyof typeof SideName]
export const SIDE_NAMES = [
  SideName.North,
  SideName.East,
  SideName.South,
  SideName.West,
] as const

export const OPPOSITE_SIDE: Record<SideName, SideName> = {
  [SideName.North]: SideName.South,
  [SideName.East]: SideName.West,
  [SideName.South]: SideName.North,
  [SideName.West]: SideName.East,
}

export const TileSideType = {
  Field: 'field',
  Road: 'road',
  City: 'city',
} as const

export type TileSideType = (typeof TileSideType)[keyof typeof TileSideType]
export const TILE_SIDE_TYPES = [
  TileSideType.Field,
  TileSideType.Road,
  TileSideType.City,
] as const

export function isTileSideType(value: unknown): value is TileSideType {
  return (
    typeof value === 'string' &&
    TILE_SIDE_TYPES.some((tileSideType) => tileSideType === value)
  )
}

export const PointDirection = {
  ...SideName,
  Center: 'center',
} as const

export type PointDirection =
  (typeof PointDirection)[keyof typeof PointDirection]

export type PointType = TileSideType

export const RotationDirection = {
  Clockwise: 'clockwise',
  Counterclockwise: 'counterclockwise',
} as const

export type RotationDirection =
  (typeof RotationDirection)[keyof typeof RotationDirection]

export const TileRotation = {
  None: 0,
  QuarterTurn: 90,
  HalfTurn: 180,
  ThreeQuarterTurn: 270,
  FullTurn: 360,
} as const

export type TileRotation = (typeof TileRotation)[keyof typeof TileRotation]

export const TILE_ROTATIONS = [
  TileRotation.None,
  TileRotation.QuarterTurn,
  TileRotation.HalfTurn,
  TileRotation.ThreeQuarterTurn,
] as const

export const RotationTurns = {
  Quarter: 1,
  ThreeQuarter: 3,
  Full: 4,
} as const

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

/** Тип фишки, которую игрок может выставить на объект. */
export const FollowerType = {
  Follower: 'follower',
  BigFollower: 'bigFollower',
  Abbot: 'abbot',
} as const

export type FollowerType = (typeof FollowerType)[keyof typeof FollowerType]

export const ExpansionName = {
  InnsAndCathedrals: 'innsAndCathedrals',
} as const

export type ExpansionName = (typeof ExpansionName)[keyof typeof ExpansionName]

/** События прикладного Socket.IO-протокола, общие для клиента и сервера. */
export const SocketEvents = {
  RegisterDevice: 'registerDevice',
  GetGamesList: 'getGamesList',
  CreateGame: 'createGame',
  GameCreated: 'gameCreated',
  UpdateGamesList: 'updateGamesList',
  JoinGame: 'joinGame',
  AddPlayer: 'addPlayer',
  RemovePlayer: 'removePlayer',
  StartGame: 'startGame',
  LeaveGame: 'leaveGame',
  RejoinGame: 'rejoinGame',
  PlayerTemporaryDisconnected: 'playerTemporaryDisconnected',
  SelectPlacingPoint: 'selectPlacingPoint',
  UpdateCurrentTile: 'updateCurrentTile',
  PlaceTile: 'placeTile',
  PlaceFollower: 'placeFollower',
  RecallAbbot: 'recallAbbot',
  SkipFollower: 'skipFollower',
  GameUpdated: 'gameUpdated',
  GameDeleted: 'gameDeleted',
  GameError: 'gameError',
  Error: 'error',
} as const

export type SocketEvent = (typeof SocketEvents)[keyof typeof SocketEvents]

export interface GameRules {
  finalScoringEnabled: boolean
  expansions: {
    innsAndCathedrals: boolean
  }
}

export interface ObjectFollower {
  playerId: PlayerId
  objectId: string
  point: Point
  isAbbot?: boolean
  isBigFollower?: boolean
}

export interface PlacedFollower {
  playerId: PlayerId
  objectId: string
  point: Point
  isMonastery?: boolean
  isGarden?: boolean
  hasInn?: boolean
  hasCathedral?: boolean
  expansion?: ExpansionName
  isAbbot?: boolean
  isBigFollower?: boolean
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
  isGarden?: boolean
  hasInn?: boolean
  hasCathedral?: boolean
  expansion?: ExpansionName
}

export interface City extends BaseObject {
  isSolidCity?: boolean
}

export type Road = BaseObject

export type Monastery = BaseObject

export interface TileSides {
  [SideName.North]: TileSideType
  [SideName.West]: TileSideType
  [SideName.South]: TileSideType
  [SideName.East]: TileSideType
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
  hasGarden?: boolean
  hasInn?: boolean
  hasCathedral?: boolean
  expansion?: ExpansionName
  /** Связанные между собой участки дороги на этой плитке. */
  roadGroups?: SideName[][]
  /** Связанные между собой участки города на этой плитке. */
  cityGroups?: SideName[][]
  /** Городские участки, в которых расположен герб. */
  cityShieldGroups?: SideName[][]
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
  bigFollowers?: number
  monks: number
}

export interface TemporaryObjects {
  cities: BaseObject[]
  roads: BaseObject[]
  monasteries: BaseObject[]
  gardens: BaseObject[]
}

export type CompletedObjects = TemporaryObjects

export type AvailableFollowerPlace = {
  point: Point
  temporaryObject: BaseObject
}

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
  GARDEN = 'GARDEN',
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
