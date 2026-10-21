/**
 * Проверка и нормализация сохранения партии.
 *
 * Одно и то же состояние приходит из трёх источников: Firebase (строка JSON
 * или уже разобранный объект), in-memory базы и загрузки старой версии.
 * Формат evolves от версии 0 (без envelope) к текущей, поэтому одна функция
 * `migrateLegacyGameState` валидирует данные, нормализует недостающие поля и
 * отдаёт состояние, готовое к восстановлению. Проверки не «чинят» значения:
 * неизвестная или неверная структура отвергается ошибкой.
 *
 * Нормализация живёт только здесь: `deserializeGameState` — единственная
 * точка, где состояние приводится к каноническому виду.
 */

import { GameManager } from './GameManager'
import { pickGameState, type IGameState } from './gameState'
import { allTileIds } from '../data/tileCatalog'
import {
  DRAGON_TOTAL_STEPS,
  SIDE_NAMES,
  isTileSideType,
  type GameRules,
} from './types'
import { SaveErrors } from './errors'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Необязательный булев флаг: отсутствие означает «выключено». */
function isOptionalBoolean(candidate: unknown): boolean {
  return candidate === undefined || typeof candidate === 'boolean'
}

export function parseJsonValue(value: unknown): unknown {
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

function restoreLegacyLobby(value: Record<string, unknown>): IGameState {
  const finalScoringEnabled =
    typeof value.finalScoringEnabled === 'boolean'
      ? value.finalScoringEnabled
      : false
  const lobby = new GameManager({
    players: value.players as IGameState['players'],
    startImmediately: false,
    finalScoringEnabled,
  })
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

  if (
    !isOptionalBoolean(expansions.innsAndCathedrals) ||
    !isOptionalBoolean(expansions.river) ||
    !isOptionalBoolean(expansions.princessAndDragon)
  ) {
    throw new Error('Game save contains invalid rules')
  }

  return {
    expansions: {
      innsAndCathedrals: expansions.innsAndCathedrals === true,
      river: expansions.river === true,
      princessAndDragon: expansions.princessAndDragon === true,
    },
  }
}

/**
 * Флаг финального подсчёта: в старых сохранениях он мог лежать только в
 * правилах. Корневое значение — единственный источник истины, из правил флаг
 * убирается.
 */
function restoreFinalScoringFlag(value: Record<string, unknown>): void {
  const legacyRules = isRecord(value.rules) ? value.rules : {}
  if (!isOptionalBoolean(legacyRules.finalScoringEnabled)) {
    throw new Error('Game save contains invalid rules')
  }
  if (value.finalScoringEnabled !== undefined) return
  value.finalScoringEnabled = legacyRules.finalScoringEnabled === true
}

/**
 * Тайлы в колоде и истории должны принадлежать включённым расширениям: иначе
 * после перезапуска партия продолжилась бы с тайлами выключенного расширения.
 */
function validateTileIds(value: Record<string, unknown>, rules: GameRules) {
  const { innsAndCathedrals, river, princessAndDragon } = rules.expansions
  if (!innsAndCathedrals && !river && !princessAndDragon) return

  const allowedIds = allTileIds(rules)
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
    Number(move.remainingSteps) > DRAGON_TOTAL_STEPS ||
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
  const choice = value.princessChoice
  if (
    !isRecord(choice) ||
    !Array.isArray(choice.followers) ||
    !choice.followers.every(
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

/**
 * Позиция дракона — единственный источник истины о том, где он стоит. В
 * незавершённом движении она всегда записана, но в очень старых сохранениях
 * могла отсутствовать: тогда она восстанавливается из последней посещённой
 * клетки, иначе ход дракона продолжить нельзя.
 */
function restoreDragonPosition(value: Record<string, unknown>): void {
  if (value.dragonPosition !== undefined) return

  const visited = isRecord(value.dragonMove)
    ? value.dragonMove.visited
    : undefined
  if (!Array.isArray(visited)) return

  const lastVisited = visited[visited.length - 1] as unknown
  if (!isRecord(lastVisited)) return

  value.dragonPosition = {
    rowIndex: lastVisited.rowIndex,
    tileIndex: lastVisited.tileIndex,
  }
}

/**
 * Список победителей появился в схеме 6. У старых сохранений его нет, поэтому
 * он восстанавливается заново из счёта: список лидеров — это чистая функция
 * таблицы очков, а не отдельные данные.
 */
function restoreWinnerPlayerIds(value: Record<string, unknown>): void {
  if (value.winnerPlayerIds !== undefined) return

  const scores = value.scores
  if (!isRecord(scores)) {
    value.winnerPlayerIds = []
    return
  }

  const entries = Object.entries(scores).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number'
  )
  if (entries.length === 0 || value.gameIsEnded !== true) {
    value.winnerPlayerIds = []
    return
  }

  const best = entries.reduce(
    (max, [, score]) => Math.max(max, score),
    -Infinity
  )
  // Ключи объектов всегда строки, даже если PlayerId — число, поэтому id
  // возвращается в том же виде, что и в остальном состоянии.
  value.winnerPlayerIds = entries
    .filter(([, score]) => score === best)
    .map(([id]) => id)
}

/**
 * Запись, прошедшая проверки выше, в типизированное состояние партии.
 *
 * Приведение единственное и локальное: проверки уже доказали форму каждого
 * поля, а `pickGameState` оставляет только известные поля — лишние ключи из
 * старых сохранений в состояние не попадают.
 */
function readMigratedState(value: Record<string, unknown>): IGameState {
  return pickGameState(value)
}

/**
 * Проверка формы состояния перед записью.
 *
 * Запись идёт из живой партии, а не извне, поэтому глубокая проверка тайлов и
 * объектов не нужна: состояние уже проверено доменом. Нормализация при этом не
 * выполняется — она живёт только в `deserializeGameState`.
 */
export function validateOutgoingState(value: unknown): void {
  if (!isRecord(value)) throw new Error(SaveErrors.SaveMustBeObject)
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new Error('Game save has no valid id')
  }
  validatePlayers(value)
  validateRequiredGameState(value)
}

export function migrateLegacyGameState(value: unknown): IGameState {
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
  restoreFinalScoringFlag(value)

  const rules = normalizeRules(value)
  value.rules = rules
  validateTileIds(value, rules)
  validateDragonPosition(value)
  validateDragonMove(value)
  validatePrincessChoice(value)
  restoreBigFollowerPools(value, rules)
  restoreDragonPosition(value)
  restoreWinnerPlayerIds(value)
  // Флаг перехода к движению дракона появился вместе с расширением; в старых
  // сохранениях его нет, и партия продолжается без ожидающего пробуждения.
  value.pendingDragonMovement ??= false
  // Штраф принцессы живёт внутри хода: в старых сохранениях его нет, и партия
  // продолжается без запрета на выставление фишки.
  value.princessFollowerPenalty ??= false
  return readMigratedState(value)
}
