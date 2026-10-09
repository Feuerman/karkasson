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
  RIVER_A: 'RIVER-A',
  RIVER_B: 'RIVER-B',
  RIVER_C: 'RIVER-C',
  RIVER_D: 'RIVER-D',
  RIVER_F: 'RIVER-F',
  RIVER_G: 'RIVER-G',
  RIVER_H: 'RIVER-H',
  RIVER_I: 'RIVER-I',
  RIVER_J: 'RIVER-J',
  RIVER_K: 'RIVER-K',
  RIVER_L: 'RIVER-L',
  PAD_A: 'PAD_A',
  PAD_B: 'PAD_B',
  PAD_C: 'PAD_C',
  PAD_D: 'PAD_D',
  PAD_E: 'PAD_E',
  PAD_F: 'PAD_F',
  PAD_G: 'PAD_G',
  PAD_H: 'PAD_H',
  PAD_I: 'PAD_I',
  PAD_J: 'PAD_J',
  PAD_K: 'PAD_K',
  PAD_L: 'PAD_L',
  PAD_M: 'PAD_M',
  PAD_N: 'PAD_N',
  PAD_O: 'PAD_O',
  PAD_P: 'PAD_P',
  PAD_Q: 'PAD_Q',
  PAD_R: 'PAD_R',
  PAD_S: 'PAD_S',
  PAD_T: 'PAD_T',
  PAD_U: 'PAD_U',
  PAD_V: 'PAD_V',
  PAD_W: 'PAD_W',
  PAD_X: 'PAD_X',
  PAD_Y: 'PAD_Y',
  PAD_Z: 'PAD_Z',
  PAD_1: 'PAD_1',
  PAD_2: 'PAD_2',
  PAD_3: 'PAD_3',
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

export const TILE_ROTATIONS = [0, 90, 180, 270] as const

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
  River: 'river',
  PrincessAndDragon: 'princessAndDragon',
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
  MoveDragon: 'moveDragon',
  ChoosePrincess: 'choosePrincess',
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
    river: boolean
    princessAndDragon: boolean
  }
}

export interface DragonPosition {
  rowIndex: number
  tileIndex: number
}

export interface DragonMoveState {
  remainingSteps: number
  nextPlayerIndex: number
  resumePlayerIndex: number
  visited: DragonPosition[]
}

export interface PrincessChoiceState {
  followers: Array<{ cityId: string; point: Point }>
}

export interface ObjectFollower {
  playerId: PlayerId
  objectId: string
  point: Point
  isAbbot?: boolean
  isBigFollower?: boolean
}

/**
 * Подданный, которого сняли с поля: та же фишка плюс объект, на котором она
 * стояла. Тип объекта определяет наименование подданного в истории: разбойник
 * на дороге, рыцарь в городе, монах в монастыре, аббат в монастыре или саду.
 * Не заполняется для сохранений старых версий.
 */
export interface ReturnedFollower extends ObjectFollower {
  objectType?: ObjectTypes
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

/**
 * Строка детализации расчёта очков объекта: из чего сложилась сумма.
 * Формируется сервером, клиент только отображает.
 */
export interface ScoreDetailLine {
  /** Что посчитано: «Тайлы дороги», «Гербы в городе», «Занятые клетки». */
  label: string
  /** Сколько единиц учтено в составляющей. */
  count: number
  /** Очки за одну единицу с учётом бонусов объекта. */
  pointsPerUnit: number
  /** Сумма составляющей в очках. */
  total: number
}

/** Детализация начисления очков: строки расчёта и повлиявшие бонусы. */
export interface ScoreDetails {
  details: ScoreDetailLine[]
  modifiers: string[]
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
  hasPrincess?: boolean
  hasDragon?: boolean
  hasVolcano?: boolean
  expansion?: ExpansionName
  /** Связанные между собой участки дороги на этой плитке. */
  roadGroups?: SideName[][]
  /** Связанные между собой участки города на этой плитке. */
  cityGroups?: SideName[][]
  /** Городские участки, в которых расположен герб. */
  cityShieldGroups?: SideName[][]
  /** Связанные русла реки; стороны в группе обозначают её выходы с тайла. */
  riverGroups?: SideName[][]
}

export interface GridTile extends Tile {
  x: number
  y: number
  rowIndex?: number
  tileIndex?: number
}

export type TilePlacesStats = Record<number, Record<number, GridTile>>

/** Несовпадение сторон при попытке размещения тайл. */
export interface TileSideConflict {
  /** Сторона нового тайла, не совпавшая с соседом. */
  side: SideName
  /** Координаты конфликтующей соседней клетки. */
  rowIndex: number
  tileIndex: number
  /** Тип стороны нового тайла. */
  own: TileSideType
  /** Тип противоположной стороны уже стоящего соседа. */
  adjacent: TileSideType
}

/** Отказ по правилам реки при попытке разместить речной тайл. */
export interface RiverPlacementConflict {
  /** Незакрытый конец русла либо выход русла не в ту сторону. */
  reason: 'openEnd' | 'wrongSide'
  /** Сторона подсвечиваемого соседа, с которой открыто русло. */
  side: SideName
  /** Координаты подсвечиваемой соседней клетки. */
  rowIndex: number
  tileIndex: number
}

/** Причина отказа при неудачном размещении тайла. */
export type PlacementConflict = TileSideConflict | RiverPlacementConflict

export function isRiverPlacementConflict(
  conflict: PlacementConflict
): conflict is RiverPlacementConflict {
  return 'reason' in conflict
}

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
  DRAGON_MOVE = 'DRAGON_MOVE',
  PRINCESS_TAKE_FOLLOWER = 'PRINCESS_TAKE_FOLLOWER',
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
