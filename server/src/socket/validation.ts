import type {
  FollowerType,
  GameOptions,
  Point,
  PointDirection,
  PointType,
} from '../modules/types'
import {
  BOARD_GRID_SIZE,
  FollowerType as FollowerTypes,
  PointDirection as PointDirections,
  TILE_ROTATIONS,
  isTileSideType,
} from '../modules/types'
import { hasControlOrFormatCharacters } from '../modules/text'
import { MAX_SESSION_TOKEN_LENGTH } from '../services/sessionToken'
import type { SocketCallback } from './types'

const MAX_GAME_ID_LENGTH = 64
const MAX_IDENTIFIER_LENGTH = 128
const MAX_PLAYER_INDEX = 5

export interface BoardPosition {
  rowIndex: number
  tileIndex: number
}

export interface FollowerPlaceRequest {
  point: Point
  temporaryObject: { id: string }
}

export interface GameRequest {
  gameId: string
}

export interface AddPlayerRequest extends GameRequest {
  index: number
  name: string | null | undefined
}

export interface RemovePlayerRequest extends GameRequest {
  index: number
  keepAsComputer: boolean
}

export interface PointRequest extends GameRequest {
  point: Point
}

export interface CityRequest extends PointRequest {
  cityId: string
}

export interface PositionRequest extends GameRequest {
  position: BoardPosition
}

export type SelectPlacingPointRequest = PositionRequest

export interface RotationRequest extends GameRequest {
  rotation?: number
  invalidRotation?: boolean
}

export interface PlaceTileRequest extends RotationRequest {
  position: BoardPosition
}

export interface PlaceFollowerRequest extends GameRequest {
  place: FollowerPlaceRequest
  followerType: FollowerType
}

export interface CreateGameRequest {
  options: GameOptions
  invalidOption?: keyof GameOptions
}

export interface CallbackRequest {
  payload: unknown
  callback: SocketCallback | undefined
}

export function payloadAndCallback(
  first: unknown,
  second: unknown
): CallbackRequest {
  if (typeof first === 'function') {
    return { payload: undefined, callback: first as SocketCallback }
  }
  return {
    payload: first,
    callback:
      typeof second === 'function' ? (second as SocketCallback) : undefined,
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function readIdentifier(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const identifier = value.trim()
  if (!identifier || identifier.length > maxLength) return undefined
  if (hasControlOrFormatCharacters(identifier)) return undefined
  return identifier
}

export function readGameId(value: unknown): string | undefined {
  return readIdentifier(value, MAX_GAME_ID_LENGTH)
}

function readPlayerIndex(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_PLAYER_INDEX
    ? value
    : undefined
}

function readBoardPosition(value: unknown): BoardPosition | undefined {
  const record = asRecord(value)
  if (!record) return undefined
  const [rows, columns] = BOARD_GRID_SIZE
  const rowIndex = record.rowIndex
  const tileIndex = record.tileIndex
  if (
    typeof rowIndex !== 'number' ||
    !Number.isInteger(rowIndex) ||
    rowIndex < 0 ||
    rowIndex >= rows ||
    typeof tileIndex !== 'number' ||
    !Number.isInteger(tileIndex) ||
    tileIndex < 0 ||
    tileIndex >= columns
  ) {
    return undefined
  }
  return { rowIndex, tileIndex }
}

function isPointDirection(value: unknown): value is PointDirection {
  return (
    typeof value === 'string' &&
    (Object.values(PointDirections) as string[]).includes(value)
  )
}

function isPointType(value: unknown): value is PointType {
  return isTileSideType(value)
}

function readOptionalInteger(
  value: unknown,
  min: number,
  max: number
): number | undefined {
  if (value === undefined) return undefined
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    return undefined
  }
  return value
}

function readPoint(value: unknown): Point | undefined {
  const record = asRecord(value)
  if (!record) return undefined
  const x = readOptionalInteger(record.x, 0, BOARD_GRID_SIZE[1] - 1)
  const y = readOptionalInteger(record.y, 0, BOARD_GRID_SIZE[0] - 1)
  if (x === undefined || y === undefined) return undefined

  const point: Point = { x, y }
  if (record.direction !== undefined) {
    if (!isPointDirection(record.direction)) return undefined
    point.direction = record.direction
  }
  if (record.pointType !== undefined) {
    if (!isPointType(record.pointType)) return undefined
    point.pointType = record.pointType
  }
  if (record.regionIndex !== undefined) {
    const regionIndex = readOptionalInteger(record.regionIndex, 0, 99)
    if (regionIndex === undefined) return undefined
    point.regionIndex = regionIndex
  }
  if (record.rowIndex !== undefined) {
    const rowIndex = readOptionalInteger(
      record.rowIndex,
      0,
      BOARD_GRID_SIZE[0] - 1
    )
    if (rowIndex === undefined) return undefined
    point.rowIndex = rowIndex
  }
  if (record.tileIndex !== undefined) {
    const tileIndex = readOptionalInteger(
      record.tileIndex,
      0,
      BOARD_GRID_SIZE[1] - 1
    )
    if (tileIndex === undefined) return undefined
    point.tileIndex = tileIndex
  }
  if (record.precisionX !== undefined) {
    if (
      typeof record.precisionX !== 'number' ||
      !Number.isFinite(record.precisionX)
    ) {
      return undefined
    }
    point.precisionX = record.precisionX
  }
  if (record.precisionY !== undefined) {
    if (
      typeof record.precisionY !== 'number' ||
      !Number.isFinite(record.precisionY)
    ) {
      return undefined
    }
    point.precisionY = record.precisionY
  }

  return point
}

function readRotation(value: unknown): number | undefined {
  return typeof value === 'number' &&
    TILE_ROTATIONS.includes(value as (typeof TILE_ROTATIONS)[number])
    ? value
    : undefined
}

function readFollowerType(value: unknown): FollowerType | undefined {
  if (value === undefined) return FollowerTypes.Follower
  return typeof value === 'string' &&
    (Object.values(FollowerTypes) as string[]).includes(value)
    ? (value as FollowerType)
    : undefined
}

function readFollowerPlace(value: unknown): FollowerPlaceRequest | undefined {
  const record = asRecord(value)
  const temporaryObject = asRecord(record?.temporaryObject)
  const point = readPoint(record?.point)
  const objectId = readIdentifier(temporaryObject?.id, MAX_IDENTIFIER_LENGTH)
  if (!point || !objectId) return undefined
  return { point, temporaryObject: { id: objectId } }
}

export function parseRegisterSession(
  value: unknown
): { token?: string } | undefined {
  if (value === undefined || value === null) return {}
  const record = asRecord(value)
  if (!record) return undefined
  const token = record.token
  if (token === undefined || token === null) return {}
  if (
    typeof token !== 'string' ||
    token.length === 0 ||
    token.length > MAX_SESSION_TOKEN_LENGTH ||
    /\s/.test(token) ||
    hasControlOrFormatCharacters(token)
  ) {
    return undefined
  }
  return { token }
}

export function parseCreateGame(value: unknown): CreateGameRequest | undefined {
  if (value === undefined || value === null) return { options: {} }
  const record = asRecord(value)
  if (!record) return undefined

  const options: GameOptions = {}
  const optionNames: Array<keyof GameOptions> = [
    'finalScoringEnabled',
    'innsAndCathedralsEnabled',
    'riverEnabled',
    'princessAndDragonEnabled',
  ]
  for (const option of optionNames) {
    const optionValue = record[option]
    if (optionValue === undefined) continue
    if (typeof optionValue !== 'boolean') {
      return { options, invalidOption: option }
    }
    options[option] = optionValue
  }
  return { options }
}

export function parseJoinGame(value: unknown): GameRequest | undefined {
  return parseGameRequest(value)
}

export function parseGameRequest(value: unknown): GameRequest | undefined {
  const record = asRecord(value)
  const gameId = readGameId(record?.gameId)
  return gameId ? { gameId } : undefined
}

export function parseAddPlayer(value: unknown): AddPlayerRequest | undefined {
  const record = asRecord(value)
  const gameId = readGameId(record?.gameId)
  const index = readPlayerIndex(record?.index)
  if (!gameId || index === undefined) return undefined

  const name = record?.name
  if (name !== undefined && name !== null && typeof name !== 'string') {
    return undefined
  }
  return { gameId, index, name }
}

export function parseRemovePlayer(
  value: unknown
): RemovePlayerRequest | undefined {
  const record = asRecord(value)
  const gameId = readGameId(record?.gameId)
  const index = readPlayerIndex(record?.index)
  const keepAsComputer = record?.keepAsComputer
  if (!gameId || index === undefined || typeof keepAsComputer !== 'boolean') {
    return undefined
  }
  return { gameId, index, keepAsComputer }
}

export function parsePositionRequest(
  value: unknown
): PositionRequest | undefined {
  const record = asRecord(value)
  const gameId = readGameId(record?.gameId)
  const position = readBoardPosition(record?.position)
  return gameId && position ? { gameId, position } : undefined
}

export function parseSelectPlacingPoint(
  value: unknown
): SelectPlacingPointRequest | undefined {
  const record = asRecord(value)
  const gameId = readGameId(record?.gameId)
  const position = readBoardPosition(record?.point)
  return gameId && position ? { gameId, position } : undefined
}

function readRotationRequest(
  record: Record<string, unknown>
): Pick<RotationRequest, 'rotation' | 'invalidRotation'> | undefined {
  const tile = record.tile
  if (tile !== undefined && !asRecord(tile)) return { invalidRotation: true }

  const hasRotation = record.rotation !== undefined
  const tileRotation = asRecord(tile)?.rotation
  if (!hasRotation && tileRotation === undefined) return {}
  const rotation = readRotation(hasRotation ? record.rotation : tileRotation)
  return rotation === undefined ? { invalidRotation: true } : { rotation }
}

export function parseUpdateCurrentTile(
  value: unknown
): RotationRequest | undefined {
  const record = asRecord(value)
  const gameId = readGameId(record?.gameId)
  if (!record || !gameId) return undefined
  const rotation = readRotationRequest(record)
  return rotation ? { gameId, ...rotation } : undefined
}

export function parsePlaceTile(value: unknown): PlaceTileRequest | undefined {
  const record = asRecord(value)
  const gameId = readGameId(record?.gameId)
  const position = readBoardPosition(record?.position)
  if (!record || !gameId || !position) return undefined
  const rotation = readRotationRequest(record)
  return rotation ? { gameId, position, ...rotation } : undefined
}

export function parsePlaceFollower(
  value: unknown
): PlaceFollowerRequest | undefined {
  const record = asRecord(value)
  const gameId = readGameId(record?.gameId)
  const place = readFollowerPlace(record?.place)
  const followerType = readFollowerType(record?.followerType)
  return gameId && place && followerType
    ? { gameId, place, followerType }
    : undefined
}

export function parsePointRequest(value: unknown): PointRequest | undefined {
  const record = asRecord(value)
  const gameId = readGameId(record?.gameId)
  const point = readPoint(record?.point)
  return gameId && point ? { gameId, point } : undefined
}

export function parseCityRequest(value: unknown): CityRequest | undefined {
  const record = asRecord(value)
  const gameId = readGameId(record?.gameId)
  const cityId = readIdentifier(record?.cityId, MAX_IDENTIFIER_LENGTH)
  const point = readPoint(record?.point)
  return gameId && cityId && point ? { gameId, cityId, point } : undefined
}
