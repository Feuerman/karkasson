/**
 * Нормализация и проверка сохранения партии.
 *
 * Одно и то же состояние приходит из трёх источников: Firebase (строка JSON
 * или уже разобранный объект), in-memory базы и загрузки старой версии.
 * Формат evolves от версии 0 (без envelope) к текущей, поэтому одна функция
 * `migrateLegacyGameState` валидирует данные, нормализует недостающие поля и
 * отдаёт состояние, готовое к восстановлению. Проверки не «чинят» значения:
 * неизвестная или неверная структура отвергается ошибкой.
 */

import { GameManager, type IGameBoard } from './GameManager'
import tiles from '../data/tiles'
import { innsAndCathedralsTiles } from '../data/innsAndCathedralsTiles'
import { riverTiles } from '../data/riverTiles'
import { princessAndDragonTiles } from '../data/princessAndDragonTiles'
import { SIDE_NAMES, isTileSideType, type GameRules } from './types'
import { SaveErrors } from './errors'

export const GAME_SAVE_SCHEMA_VERSION = 5

/** Версии envelope, которые ещё можно прочитать. */
const SUPPORTED_SCHEMA_VERSIONS = [1, 2, 3, 4, GAME_SAVE_SCHEMA_VERSION]

const DEFAULT_RULES: GameRules = {
  finalScoringEnabled: false,
  expansions: {
    innsAndCathedrals: false,
    river: false,
    princessAndDragon: false,
  },
}

interface VersionedGameSave {
  schemaVersion: number
  state: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value) as unknown
  } catch {
    throw new Error('Game save is not valid JSON')
  }
}

function isTile(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== 'string') return false
  if (!Number.isInteger(value.rotation)) return false
  const sides = value.sides
  if (!isRecord(sides)) return false

  return SIDE_NAMES.every((side) => isTileSideType(sides[side]))
}

function isGameObject(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    Array.isArray(value.points) &&
    Array.isArray(value.followers)
  )
}

function validatePlayers(value: Record<string, unknown>): void {
  if (!Array.isArray(value.players)) {
    throw new Error('Game save has no players array')
  }
  if (
    !value.players.every(
      (player) =>
        isRecord(player) &&
        (typeof player.id === 'number' || typeof player.id === 'string') &&
        (typeof player.name === 'string' || player.name === null) &&
        (typeof player.socketId === 'string' || player.socketId === null) &&
        (typeof player.deviceId === 'string' || player.deviceId === null) &&
        (typeof player.color === 'string' || player.color === null) &&
        typeof player.score === 'number'
    )
  ) {
    throw new Error('Game save contains an invalid player')
  }
}

function isLegacyLobby(value: Record<string, unknown>): boolean {
  return (
    value.gameIsStarted !== true &&
    !('tilePlacesStats' in value) &&
    !('gameIsEnded' in value)
  )
}

function restoreLegacyLobby(value: Record<string, unknown>): IGameBoard {
  const finalScoringEnabled =
    typeof value.finalScoringEnabled === 'boolean'
      ? value.finalScoringEnabled
      : false
  const lobby = new GameManager({
    players: value.players as IGameBoard['players'],
    startImmediately: false,
    finalScoringEnabled,
  })
  lobby.rules = {
    ...(lobby.rules ?? structuredClone(DEFAULT_RULES)),
    finalScoringEnabled,
  }
  lobby.id = value.id as string
  return lobby
}

function validateTileLists(value: Record<string, unknown>): void {
  const requiredArrays = [
    'tilesList',
    'tileHistory',
    'availablePlacesTiles',
    'availableFollowersPlaces',
    'placedFollowers',
    'actionsHistory',
  ]
  if (requiredArrays.some((key) => !Array.isArray(value[key]))) {
    throw new Error('Game save contains an invalid list')
  }
  const tilesList = value.tilesList
  const tileHistory = value.tileHistory
  if (
    !Array.isArray(tilesList) ||
    !Array.isArray(tileHistory) ||
    !tilesList.every(isTile) ||
    !tileHistory.every(isTile) ||
    (value.currentTile !== null && !isTile(value.currentTile))
  ) {
    throw new Error(SaveErrors.SaveInvalidTile)
  }
}

/**
 * Коллекции объектов должны существовать и содержать только объекты.
 * Сады появились позже остальных, поэтому для них допускается пустой список.
 */
function validateObjectCollections(value: Record<string, unknown>): void {
  const requiredRecords = [
    'scores',
    'playersFollowers',
    'tilePlacesStats',
    'temporaryObjects',
    'completedObjects',
  ]
  if (requiredRecords.some((key) => !isRecord(value[key]))) {
    throw new Error('Game save contains an invalid state object')
  }

  const temporaryObjects = value.temporaryObjects
  const completedObjects = value.completedObjects
  if (!isRecord(temporaryObjects) || !isRecord(completedObjects)) {
    throw new Error('Game save contains invalid object collections')
  }

  temporaryObjects.gardens ??= []
  completedObjects.gardens ??= []
  const collections = ['cities', 'roads', 'monasteries', 'gardens'] as const

  if (
    !collections.every(
      (key) =>
        Array.isArray(temporaryObjects[key]) &&
        Array.isArray(completedObjects[key])
    )
  ) {
    throw new Error('Game save contains invalid object collections')
  }
  if (
    !collections.every(
      (key) =>
        (temporaryObjects[key] as unknown[]).every(isGameObject) &&
        (completedObjects[key] as unknown[]).every(isGameObject)
    )
  ) {
    throw new Error('Game save contains an invalid game object')
  }
}

function validateRequiredGameState(value: Record<string, unknown>): void {
  if (
    typeof value.gameIsStarted !== 'boolean' ||
    typeof value.gameIsEnded !== 'boolean' ||
    !Array.isArray(value.tilesList) ||
    !Array.isArray(value.tileHistory) ||
    !isRecord(value.tilePlacesStats) ||
    !isRecord(value.temporaryObjects) ||
    !isRecord(value.completedObjects) ||
    !isRecord(value.playersFollowers) ||
    !isRecord(value.scores) ||
    !Number.isInteger(value.currentPlayerIndex) ||
    typeof value.isPlacingFollower !== 'boolean' ||
    typeof value.moveCounter !== 'number' ||
    typeof value.lastUpdate !== 'number'
  ) {
    throw new Error('Game save is missing required state')
  }
  if (
    !Object.values(value.playersFollowers).every(
      (pool) =>
        isRecord(pool) &&
        Number.isInteger(pool.ordinaryFollowers) &&
        Number.isInteger(pool.monks) &&
        Number(pool.ordinaryFollowers) >= 0 &&
        Number(pool.monks) >= 0 &&
        (pool.bigFollowers === undefined ||
          (Number.isInteger(pool.bigFollowers) &&
            Number(pool.bigFollowers) >= 0))
    )
  ) {
    throw new Error(SaveErrors.SaveInvalidFollowerPool)
  }
}

/**
 * Проверка и нормализация правил партии: неизвестные значения отвергаются,
 * отсутствующие заменяются выключенными. Возвращает нормализованные правила.
 */
function normalizeRules(value: Record<string, unknown>): GameRules {
  const rules = isRecord(value.rules) ? value.rules : {}
  const expansions = isRecord(rules.expansions) ? rules.expansions : {}

  const isOptionalBoolean = (candidate: unknown) =>
    candidate === undefined || typeof candidate === 'boolean'
  if (
    !isOptionalBoolean(rules.finalScoringEnabled) ||
    !isOptionalBoolean(expansions.innsAndCathedrals) ||
    !isOptionalBoolean(expansions.river) ||
    !isOptionalBoolean(expansions.princessAndDragon)
  ) {
    throw new Error('Game save contains invalid rules')
  }

  return {
    // Флаг финального подсчёта исторически хранился и в корне состояния, и в
    // правилах; корневое значение — источник истины.
    finalScoringEnabled: value.finalScoringEnabled === true,
    expansions: {
      innsAndCathedrals: expansions.innsAndCathedrals === true,
      river: expansions.river === true,
      princessAndDragon: expansions.princessAndDragon === true,
    },
  }
}

/** Все тайлы, которые в принципе могут лежать в сохранении при этих правилах. */
function allowedTileIds(rules: GameRules): Set<string> {
  return new Set<string>([
    ...tiles.map((tile) => tile.id),
    ...(rules.expansions.innsAndCathedrals
      ? innsAndCathedralsTiles.map((tile) => tile.id)
      : []),
    ...(rules.expansions.river ? riverTiles.map((tile) => tile.id) : []),
    ...(rules.expansions.princessAndDragon
      ? princessAndDragonTiles.map((tile) => tile.id)
      : []),
  ])
}

/**
 * Тайлы в колоде и истории должны принадлежать включённым расширениям: иначе
 * после перезапуска партия продолжилась бы с тайлами выключенного расширения.
 */
function validateTileIds(value: Record<string, unknown>, rules: GameRules) {
  const { innsAndCathedrals, river, princessAndDragon } = rules.expansions
  if (!innsAndCathedrals && !river && !princessAndDragon) return

  const allowedIds = allowedTileIds(rules)
  for (const collection of [value.tilesList, value.tileHistory]) {
    if (
      Array.isArray(collection) &&
      collection.some(
        (tile) =>
          isRecord(tile) &&
          typeof tile.id === 'string' &&
          !allowedIds.has(tile.id)
      )
    ) {
      throw new Error(SaveErrors.SaveInvalidTile)
    }
  }
}

/** Позиция дракона: только целые координаты. */
function validateDragonPosition(value: Record<string, unknown>) {
  if (value.dragonPosition === undefined) return
  if (
    !isRecord(value.dragonPosition) ||
    !Number.isInteger(value.dragonPosition.rowIndex) ||
    !Number.isInteger(value.dragonPosition.tileIndex)
  ) {
    throw new Error('Game save contains an invalid dragon position')
  }
}

/** Незавершённый ход дракона: шаги, очередь и посещённые клетки. */
function validateDragonMove(value: Record<string, unknown>) {
  if (value.dragonMove === undefined) return
  const move = value.dragonMove
  if (
    !isRecord(move) ||
    !Number.isInteger(move.remainingSteps) ||
    Number(move.remainingSteps) < 0 ||
    Number(move.remainingSteps) > 6 ||
    !Number.isInteger(move.nextPlayerIndex) ||
    !Number.isInteger(move.resumePlayerIndex) ||
    !Array.isArray(move.visited) ||
    !move.visited.every(
      (position) =>
        isRecord(position) &&
        Number.isInteger(position.rowIndex) &&
        Number.isInteger(position.tileIndex)
    )
  ) {
    throw new Error('Game save contains an invalid dragon move')
  }
}

/** Выбор принцессы: список городов и клеток с подданными. */
function validatePrincessChoice(value: Record<string, unknown>) {
  if (value.princessChoice === undefined) return
  if (
    !isRecord(value.princessChoice) ||
    !Array.isArray(value.princessChoice.followers) ||
    !value.princessChoice.followers.every(
      (follower) =>
        isRecord(follower) &&
        typeof follower.cityId === 'string' &&
        isRecord(follower.point) &&
        typeof follower.point.x === 'number' &&
        typeof follower.point.y === 'number'
    )
  ) {
    throw new Error('Game save contains an invalid princess choice')
  }
}

/**
 * Старые сохранения не знали о больших подданных: при включённом расширении
 * каждому игроку возвращается его одна большая подданная.
 */
function restoreBigFollowerPools(
  value: Record<string, unknown>,
  rules: GameRules
) {
  if (!isRecord(value.playersFollowers)) return
  if (!rules.expansions.innsAndCathedrals) return

  for (const pool of Object.values(value.playersFollowers)) {
    if (isRecord(pool)) pool.bigFollowers ??= 1
  }
}

function migrateLegacyGameState(value: unknown): IGameBoard {
  if (!isRecord(value)) throw new Error(SaveErrors.SaveMustBeObject)
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new Error('Game save has no valid id')
  }

  validatePlayers(value)
  if (
    value.finalScoringEnabled !== undefined &&
    typeof value.finalScoringEnabled !== 'boolean'
  ) {
    throw new Error('Game save contains an invalid final scoring option')
  }
  if (isLegacyLobby(value)) return restoreLegacyLobby(value)

  validateTileLists(value)
  validateObjectCollections(value)
  validateRequiredGameState(value)
  value.finalScoringEnabled ??= false

  const rules = normalizeRules(value)
  value.rules = rules
  validateTileIds(value, rules)
  validateDragonPosition(value)
  validateDragonMove(value)
  validatePrincessChoice(value)
  restoreBigFollowerPools(value, rules)
  return value as unknown as IGameBoard
}

export function serializeGameState(game: IGameBoard): string {
  // Migration normalizes these containers in place. Copy only those mutable
  // containers so serialization can validate without cloning the whole game
  // through an intermediate JSON string.
  const state = {
    ...game,
    rules: {
      ...game.rules,
      expansions: { ...game.rules.expansions },
    },
    temporaryObjects: {
      ...game.temporaryObjects,
      gardens: game.temporaryObjects.gardens ?? [],
    },
    completedObjects: {
      ...game.completedObjects,
      gardens: game.completedObjects.gardens ?? [],
    },
    playersFollowers: Object.fromEntries(
      Object.entries(game.playersFollowers).map(([playerId, pool]) => [
        playerId,
        { ...pool },
      ])
    ),
  }
  migrateLegacyGameState(state)
  const save: VersionedGameSave = {
    schemaVersion: GAME_SAVE_SCHEMA_VERSION,
    state,
  }
  return JSON.stringify(save)
}

export function deserializeGameState(raw: unknown): IGameBoard {
  const parsed = parseJsonValue(raw)
  if (!isRecord(parsed)) throw new Error(SaveErrors.SaveMustBeObject)

  if ('schemaVersion' in parsed) {
    if (!SUPPORTED_SCHEMA_VERSIONS.includes(Number(parsed.schemaVersion))) {
      throw new Error(
        `Unsupported game save schema version: ${String(parsed.schemaVersion)}`
      )
    }
    return migrateLegacyGameState(parsed.state)
  }

  // Saves produced before schema envelopes were introduced are version 0.
  return migrateLegacyGameState(parsed)
}
