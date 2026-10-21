import type { IGameState } from './gameState'
import { applyQuarterTurns } from './tileRotation'
import type {
  AvailableFollowerPlace,
  AvailablePlace,
  BaseObject,
  CompletedObjects,
  FollowerCount,
  FollowerType,
  GameRules,
  ObjectFollower,
  Player,
  PlayerId,
  PlacedFollower,
  Scores,
  TemporaryObjects,
  Tile,
  TilePlacesStats,
} from './types'

export interface SimulationMove {
  tile: Tile
  rowIndex: number
  tileIndex: number
  rotation: number
  followerPlace?: AvailableFollowerPlace
  followerType?: FollowerType
}

export interface SimulationResult {
  score: number
  moves: SimulationMove[]
}

/**
 * Часть доски, которой пользуется симулятор.
 *
 * Симулятору нужны пробные ходы, копия состояния и несколько полей для оценки
 * — не вся доска целиком. Описание здесь узкое, поэтому симулятор не зависит
 * от класса партии.
 */
export interface SimulationBoard {
  availablePlacesTiles: AvailablePlace[]
  availableFollowersPlaces: AvailableFollowerPlace[]
  completedObjects: CompletedObjects
  currentPlayer: Player | null
  placedFollowers: PlacedFollower[]
  playersFollowers: Record<PlayerId, FollowerCount>
  rules: GameRules
  scores: Scores
  temporaryObjects: TemporaryObjects
  tilePlacesStats: TilePlacesStats
  actionsHistory: IGameState['actionsHistory']
  cloneForSimulation(): SimulationBoard
  simulatePlaceTile(tile: Tile, rowIndex: number, tileIndex: number): boolean
  simulatePlaceFollower(
    place: AvailableFollowerPlace,
    followerType?: FollowerType
  ): boolean
  getAvailableFollowerTypes(place: AvailableFollowerPlace): FollowerType[]
}

/** Снимок одной коллекции объектов доски для отката пробного хода. */
interface ObjectCollectionSnapshot {
  /** Массив доски, который возвращается на место при откате. */
  objects: BaseObject[]
  /** Состояние объектов на момент снимка. */
  saved: BaseObject[]
  /** Объекты доски по идентификатору: ссылки на них переиспользуются. */
  index: Map<string, BaseObject>
  /** Массив, который заполняется при каждом откате. */
  restored: BaseObject[]
}

/** Изменяемые коллекции одного пробного размещения; доска здесь не копируется. */
interface TileSimulationSnapshot {
  temporaryCollections: ObjectCollectionSnapshot[]
  completedCollections: ObjectCollectionSnapshot[]
  scores: IGameState['scores']
  scoreState: IGameState['scores']
  placedFollowers: IGameState['placedFollowers']
  placedFollowerState: IGameState['placedFollowers']
  playersFollowers: IGameState['playersFollowers']
  followerPoolState: IGameState['playersFollowers']
  availableFollowersPlaces: IGameState['availableFollowersPlaces']
  availableFollowerState: IGameState['availableFollowersPlaces']
  actionsHistoryLength: number
  placedTile?: IGameState['tilePlacesStats'][number][number]
  hadRow: boolean
}

type HeuristicGameState = Pick<
  IGameState,
  'scores' | 'currentPlayer' | 'temporaryObjects' | 'rules'
>

const TILE_ROTATION_STEPS = [0, 1, 2, 3]

/** Вес типа объекта в оценке хода: сколько очков эвристики даёт одна фишка. */
const OBJECT_WEIGHTS = {
  cities: 2,
  roads: 1,
  monasteries: 3,
  gardens: 3,
} as const

/**
 * Больше фишка за ход не даёт: тяжёлый объект весит 3, большой подданный
 * считается за две фишки. Нужен, чтобы не перебирать фишки там, где они
 * заведомо не улучшат лучший найденный ход.
 */
const MAX_FOLLOWER_GAIN = Math.max(...Object.values(OBJECT_WEIGHTS)) * 2

/**
 * Поворот тайла для перебора: стороны и группы соединений поворачиваются
 * вместе, поэтому используется общий поворот тайла, а не свой набор правил.
 */
function rotateTile(tile: Tile, turns: number): Tile {
  return {
    ...applyQuarterTurns(tile, turns),
    rotation: (tile.rotation + turns * 90) % 360,
  }
}

/**
 * Копия объекта для снимка.
 *
 * `points` и `followers` копируются поверхностно: пробный ход либо заменяет
 * массив целиком (объединение участков), либо дописывает фишку в конец, и
 * откат убирает её обратно по длине. Правок элементов на месте нет, поэтому
 * снимок остаётся неизменным и при переборе всех поворотов одной позиции.
 * `score` — итог последнего подсчёта, он только переопределяется целиком.
 */
function copyObject(object: BaseObject): BaseObject {
  return {
    ...object,
    score: object.score
      ? { ...object.score, players: { ...object.score.players } }
      : undefined,
    points: [...object.points],
    followers: object.followers.map((follower) => ({ ...follower })),
  }
}

/** Запасы подданных — плоские числа, их достаточно скопировать поверхностно. */
function copyFollowerPools(
  pools: IGameState['playersFollowers']
): Record<PlayerId, FollowerCount> {
  const copies: Record<PlayerId, FollowerCount> = {}
  for (const playerId of Object.keys(pools) as PlayerId[]) {
    const pool = pools[playerId]
    if (pool) copies[playerId] = { ...pool }
  }
  return copies
}

function followerStrength(follower: ObjectFollower): number {
  return follower.isBigFollower ? 2 : 1
}

function countOwnedFollowers(
  objects: BaseObject[],
  playerId: PlayerId,
  innsAndCathedralsEnabled: boolean
): number {
  let strength = 0
  for (const object of objects) {
    for (const follower of object.followers) {
      if (follower.playerId !== playerId) continue
      strength += innsAndCathedralsEnabled ? followerStrength(follower) : 1
    }
  }
  return strength
}

export function calculateHeuristicScore(gameState: HeuristicGameState): number {
  let completedScore = 0
  for (const playerId of Object.keys(gameState.scores)) {
    completedScore += gameState.scores[playerId]
  }

  const currentPlayer = gameState.currentPlayer
  if (!currentPlayer) return completedScore

  const innsAndCathedrals = gameState.rules.expansions.innsAndCathedrals
  const temporaryObjects = gameState.temporaryObjects
  const playerId = currentPlayer.id
  return (
    completedScore +
    countOwnedFollowers(temporaryObjects.cities, playerId, innsAndCathedrals) *
      OBJECT_WEIGHTS.cities +
    countOwnedFollowers(temporaryObjects.roads, playerId, innsAndCathedrals) *
      OBJECT_WEIGHTS.roads +
    countOwnedFollowers(
      temporaryObjects.monasteries,
      playerId,
      innsAndCathedrals
    ) *
      OBJECT_WEIGHTS.monasteries +
    countOwnedFollowers(temporaryObjects.gardens, playerId, innsAndCathedrals) *
      OBJECT_WEIGHTS.gardens
  )
}

export class GameSimulatorModule {
  private gameState: SimulationBoard

  constructor(gameBoard: SimulationBoard) {
    this.gameState = gameBoard.cloneForSimulation()
  }

  findBestMove(tile: Tile): SimulationResult {
    let bestScore = -Infinity
    let bestMoves: SimulationMove[] = []

    const rotatedTiles = TILE_ROTATION_STEPS.map((turns) =>
      rotateTile(tile, turns)
    )

    for (const { rowIndex, tileIndex } of this.gameState.availablePlacesTiles) {
      // Снимок берётся на позицию, а не на поворот: все четыре поворота одного
      // места откатываются в одно и то же состояние, поэтому копировать доску
      // четыре раза подряд незачем.
      const snapshot = this.snapshotTilePlacement(rowIndex, tileIndex)

      for (const rotatedTile of rotatedTiles) {
        try {
          if (
            !this.gameState.simulatePlaceTile(rotatedTile, rowIndex, tileIndex)
          ) {
            continue
          }

          const scoreWithoutFollower = calculateHeuristicScore(this.gameState)
          if (scoreWithoutFollower > bestScore) {
            bestScore = scoreWithoutFollower
            bestMoves = [
              {
                tile: rotatedTile,
                rowIndex,
                tileIndex,
                rotation: rotatedTile.rotation,
              },
            ]
          }

          // Фишки перебираются только там, где они ещё могут улучшить ход.
          if (scoreWithoutFollower + MAX_FOLLOWER_GAIN <= bestScore) continue

          const followerMove = this.findBestFollowerMove(
            rotatedTile,
            rowIndex,
            tileIndex
          )
          if (followerMove && followerMove.score > bestScore) {
            bestScore = followerMove.score
            bestMoves = [followerMove.move]
          }
        } finally {
          this.restoreTilePlacement(rowIndex, tileIndex, snapshot)
        }
      }
    }

    return { score: bestScore, moves: bestMoves }
  }

  /**
   * Лучшая расстановка фишки на уже поставленном тайле. Пробные фишки
   * откатываются на месте, доска и объекты для этого не копируются.
   */
  private findBestFollowerMove(
    rotatedTile: Tile,
    rowIndex: number,
    tileIndex: number
  ): { score: number; move: SimulationMove } | undefined {
    let bestScore = -Infinity
    let bestMove: SimulationMove | undefined

    for (const place of this.gameState.availableFollowersPlaces) {
      for (const followerType of this.gameState.getAvailableFollowerTypes(
        place
      )) {
        const pool =
          this.gameState.playersFollowers[
            this.gameState.currentPlayer?.id ?? ''
          ]
        const placedObject = place.temporaryObject
        const previousFollowersLength = placedObject.followers.length
        const previousPlacedFollowersLength =
          this.gameState.placedFollowers.length
        const previousPool = pool ? { ...pool } : undefined

        try {
          if (!this.gameState.simulatePlaceFollower(place, followerType)) {
            continue
          }

          const score = calculateHeuristicScore(this.gameState)
          if (score > bestScore) {
            bestScore = score
            bestMove = {
              tile: rotatedTile,
              rowIndex,
              tileIndex,
              rotation: rotatedTile.rotation,
              followerPlace: {
                point: { ...place.point },
                temporaryObject: copyObject(placedObject),
              },
              followerType,
            }
          }
        } finally {
          placedObject.followers.length = previousFollowersLength
          this.gameState.placedFollowers.length = previousPlacedFollowersLength
          if (pool && previousPool) Object.assign(pool, previousPool)
        }
      }
    }

    return bestMove ? { score: bestScore, move: bestMove } : undefined
  }

  private snapshotTilePlacement(
    rowIndex: number,
    tileIndex: number
  ): TileSimulationSnapshot {
    const gameState = this.gameState
    const row = gameState.tilePlacesStats[rowIndex]
    const scores = gameState.scores
    const placedFollowers = gameState.placedFollowers
    const playersFollowers = gameState.playersFollowers
    const availableFollowersPlaces = gameState.availableFollowersPlaces
    return {
      temporaryCollections: snapshotObjectCollections(
        gameState.temporaryObjects
      ),
      completedCollections: snapshotObjectCollections(
        gameState.completedObjects
      ),
      scores,
      scoreState: { ...scores },
      placedFollowers,
      placedFollowerState: placedFollowers.map((follower) => ({ ...follower })),
      playersFollowers,
      followerPoolState: copyFollowerPools(playersFollowers),
      availableFollowersPlaces,
      availableFollowerState: [...availableFollowersPlaces],
      actionsHistoryLength: gameState.actionsHistory.length,
      placedTile: row?.[tileIndex],
      hadRow: row !== undefined,
    }
  }

  private restoreTilePlacement(
    rowIndex: number,
    tileIndex: number,
    snapshot: TileSimulationSnapshot
  ): void {
    const gameState = this.gameState
    restoreObjectCollections(
      gameState.temporaryObjects,
      snapshot.temporaryCollections
    )
    restoreObjectCollections(
      gameState.completedObjects,
      snapshot.completedCollections
    )
    snapshot.placedFollowers.splice(
      0,
      snapshot.placedFollowers.length,
      ...snapshot.placedFollowerState
    )
    gameState.placedFollowers = snapshot.placedFollowers
    for (const [playerId, pool] of Object.entries(snapshot.playersFollowers)) {
      const savedPool = snapshot.followerPoolState[playerId]
      if (savedPool) Object.assign(pool, savedPool)
    }
    gameState.playersFollowers = snapshot.playersFollowers
    snapshot.availableFollowersPlaces.splice(
      0,
      snapshot.availableFollowersPlaces.length,
      ...snapshot.availableFollowerState
    )
    gameState.availableFollowersPlaces = snapshot.availableFollowersPlaces
    gameState.actionsHistory.length = snapshot.actionsHistoryLength

    for (const playerId of Object.keys(snapshot.scores)) {
      if (!(playerId in snapshot.scoreState)) delete snapshot.scores[playerId]
    }
    Object.assign(snapshot.scores, snapshot.scoreState)
    gameState.scores = snapshot.scores

    const row = gameState.tilePlacesStats[rowIndex]
    if (snapshot.placedTile && row) {
      row[tileIndex] = snapshot.placedTile
    } else if (row) {
      delete row[tileIndex]
      if (!snapshot.hadRow && Object.keys(row).length === 0) {
        delete gameState.tilePlacesStats[rowIndex]
      }
    }
  }
}

function snapshotObjectCollections(
  collections: CompletedObjects
): ObjectCollectionSnapshot[] {
  return (['cities', 'roads', 'monasteries', 'gardens'] as const).map((key) => {
    const objects = collections[key]
    return {
      objects,
      saved: objects.map(copyObject),
      index: new Map(objects.map((object) => [object.id, object])),
      restored: [],
    }
  })
}

function restoreObjectCollections(
  target: CompletedObjects,
  collections: ObjectCollectionSnapshot[]
): void {
  const keys = ['cities', 'roads', 'monasteries', 'gardens'] as const
  for (let position = 0; position < collections.length; position += 1) {
    const { objects, saved, index, restored } = collections[position]
    restored.length = 0
    for (const savedObject of saved) {
      const object = index.get(savedObject.id)
      if (!object) {
        restored.push(savedObject)
        continue
      }

      // Массивы отдаются доске из снимка: по инварианту `copyObject` их
      // элементы не правятся на месте, поэтому снимок остаётся пригодным для
      // отката остальных поворотов этой позиции.
      Object.assign(object, savedObject)
      object.points = savedObject.points
      object.followers = savedObject.followers
      restored.push(object)
    }

    objects.splice(0, objects.length, ...restored)
    target[keys[position]] = objects
  }
}
