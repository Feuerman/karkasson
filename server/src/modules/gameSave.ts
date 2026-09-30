import { GameManager, type IGameBoard } from './GameManager'
import tiles from '../data/tiles'
import { innsAndCathedralsTiles } from '../data/innsAndCathedralsTiles'
import { riverTiles } from '../data/riverTiles'
import { SIDE_NAMES, isTileSideType, type GameRules } from './types'

export const GAME_SAVE_SCHEMA_VERSION = 4

const DEFAULT_RULES: GameRules = {
  finalScoringEnabled: false,
  expansions: { innsAndCathedrals: false, river: false },
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
  const lobby = new GameManager({
    players: value.players as IGameBoard['players'],
    startImmediately: false,
    finalScoringEnabled:
      typeof value.finalScoringEnabled === 'boolean'
        ? value.finalScoringEnabled
        : false,
  })
  const rules = lobby.rules ?? structuredClone(DEFAULT_RULES)
  rules.finalScoringEnabled = lobby.finalScoringEnabled
  lobby.rules = rules
  if (
    typeof value.finalScoringEnabled === 'boolean' &&
    typeof lobby.rules === 'object'
  ) {
    lobby.rules.finalScoringEnabled = value.finalScoringEnabled
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
    throw new Error('Game save contains an invalid tile')
  }
}

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
  if (
    !isRecord(temporaryObjects) ||
    !isRecord(completedObjects) ||
    !['cities', 'roads', 'monasteries'].every(
      (key) =>
        Array.isArray(temporaryObjects[key]) &&
        Array.isArray(completedObjects[key])
    )
  ) {
    throw new Error('Game save contains invalid object collections')
  }
  if (
    !['cities', 'roads', 'monasteries'].every((key) => {
      const temporary = temporaryObjects[key]
      const completed = completedObjects[key]
      return (
        Array.isArray(temporary) &&
        temporary.every(isGameObject) &&
        Array.isArray(completed) &&
        completed.every(isGameObject)
      )
    })
  ) {
    throw new Error('Game save contains an invalid game object')
  }

  // Garden arrays were added after the initial save format.
  temporaryObjects.gardens ??= []
  completedObjects.gardens ??= []
  if (
    !Array.isArray(temporaryObjects.gardens) ||
    !Array.isArray(completedObjects.gardens) ||
    !temporaryObjects.gardens.every(isGameObject) ||
    !completedObjects.gardens.every(isGameObject)
  ) {
    throw new Error('Game save contains invalid garden collections')
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
    throw new Error('Game save contains an invalid follower pool')
  }
}

function migrateLegacyGameState(value: unknown): IGameBoard {
  if (!isRecord(value)) throw new Error('Game save must be an object')
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
  const rules = isRecord(value.rules) ? value.rules : {}
  const expansions = isRecord(rules.expansions) ? rules.expansions : {}
  if (
    (rules.finalScoringEnabled !== undefined &&
      typeof rules.finalScoringEnabled !== 'boolean') ||
    (expansions.innsAndCathedrals !== undefined &&
      typeof expansions.innsAndCathedrals !== 'boolean') ||
    (expansions.river !== undefined && typeof expansions.river !== 'boolean')
  ) {
    throw new Error('Game save contains invalid rules')
  }
  const normalizedRules: GameRules = {
    finalScoringEnabled: value.finalScoringEnabled === true,
    expansions: {
      innsAndCathedrals: expansions.innsAndCathedrals === true,
      river: expansions.river === true,
    },
  }
  value.rules = normalizedRules
  if (
    normalizedRules.expansions.innsAndCathedrals ||
    normalizedRules.expansions.river
  ) {
    const allowedTileIds = new Set<string>([
      ...tiles.map((tile) => tile.id),
      ...(normalizedRules.expansions.innsAndCathedrals
        ? innsAndCathedralsTiles.map((tile) => tile.id)
        : []),
      ...(normalizedRules.expansions.river
        ? riverTiles.map((tile) => tile.id)
        : []),
    ])
    const tileCollections = [value.tilesList, value.tileHistory]
    for (const collection of tileCollections) {
      if (
        Array.isArray(collection) &&
        collection.some(
          (tile) =>
            isRecord(tile) &&
            typeof tile.id === 'string' &&
            !allowedTileIds.has(tile.id)
        )
      ) {
        throw new Error('Game save contains an invalid tile')
      }
    }
  }
  if (isRecord(value.playersFollowers)) {
    for (const pool of Object.values(value.playersFollowers)) {
      if (isRecord(pool) && normalizedRules.expansions.innsAndCathedrals) {
        pool.bigFollowers ??= 1
      }
    }
  }
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
  if (!isRecord(parsed)) throw new Error('Game save must be an object')

  if ('schemaVersion' in parsed) {
    if (
      parsed.schemaVersion !== 1 &&
      parsed.schemaVersion !== 2 &&
      parsed.schemaVersion !== 3 &&
      parsed.schemaVersion !== GAME_SAVE_SCHEMA_VERSION
    ) {
      throw new Error(
        `Unsupported game save schema version: ${String(parsed.schemaVersion)}`
      )
    }
    return migrateLegacyGameState(parsed.state)
  }

  // Saves produced before schema envelopes were introduced are version 0.
  return migrateLegacyGameState(parsed)
}
