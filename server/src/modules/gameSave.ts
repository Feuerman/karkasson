import { GameManager, type IGameBoard } from './GameManager'

export const GAME_SAVE_SCHEMA_VERSION = 1

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

  return ['north', 'east', 'south', 'west'].every((side) =>
    ['field', 'road', 'city'].includes(String(sides[side]))
  )
}

function isGameObject(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    Array.isArray(value.points) &&
    Array.isArray(value.followers)
  )
}

function migrateLegacyGameState(value: unknown): IGameBoard {
  if (!isRecord(value)) throw new Error('Game save must be an object')
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new Error('Game save has no valid id')
  }
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

  if (
    value.gameIsStarted !== true &&
    !('tilePlacesStats' in value) &&
    !('gameIsEnded' in value)
  ) {
    if (
      !value.players.every(
        (player) =>
          isRecord(player) &&
          (player.name === '' ||
            player.name === null ||
            typeof player.name === 'string') &&
          (player.socketId === null || typeof player.socketId === 'string') &&
          (player.deviceId === null || typeof player.deviceId === 'string')
      )
    ) {
      throw new Error('Legacy lobby save contains an invalid player')
    }
    const lobby = new GameManager({
      players: value.players as IGameBoard['players'],
      startImmediately: false,
    })
    lobby.id = value.id
    return lobby
  }

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
        Number(pool.monks) >= 0
    )
  ) {
    throw new Error('Game save contains an invalid follower pool')
  }
  return value as unknown as IGameBoard
}

export function serializeGameState(game: IGameBoard): string {
  const state = JSON.parse(JSON.stringify(game)) as unknown
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
    if (parsed.schemaVersion !== GAME_SAVE_SCHEMA_VERSION) {
      throw new Error(
        `Unsupported game save schema version: ${String(parsed.schemaVersion)}`
      )
    }
    return migrateLegacyGameState(parsed.state)
  }

  // Saves produced before schema envelopes were introduced are version 0.
  return migrateLegacyGameState(parsed)
}
