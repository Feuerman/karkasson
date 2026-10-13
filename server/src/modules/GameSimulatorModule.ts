import type { IGameBoard } from './GameManager'
import type {
  AvailableFollowerPlace,
  BaseObject,
  FollowerType,
  ObjectFollower,
  Tile,
} from './types'
import { FollowerType as FollowerTypes } from './types'
import { rotateTileGroups, rotateTileSides } from './tileRotation'

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

/** Изменяемые коллекции одного пробного размещения; доска здесь не копируется. */
interface TileSimulationSnapshot {
  temporaryObjects: IGameBoard['temporaryObjects']
  temporaryArrays: IGameBoard['temporaryObjects']
  temporaryObjectState: IGameBoard['temporaryObjects']
  completedObjects: IGameBoard['completedObjects']
  completedArrays: IGameBoard['completedObjects']
  completedObjectState: IGameBoard['completedObjects']
  scores: IGameBoard['scores']
  scoreState: IGameBoard['scores']
  placedFollowers: IGameBoard['placedFollowers']
  placedFollowerState: IGameBoard['placedFollowers']
  playersFollowers: IGameBoard['playersFollowers']
  followerPoolState: IGameBoard['playersFollowers']
  availableFollowersPlaces: IGameBoard['availableFollowersPlaces']
  availableFollowerState: IGameBoard['availableFollowersPlaces']
  actionsHistoryLength: number
  placedTile?: IGameBoard['tilePlacesStats'][number][number]
  hadRow: boolean
}

type HeuristicGameState = Pick<
  IGameBoard,
  'scores' | 'currentPlayer' | 'temporaryObjects' | 'rules'
>

function followerStrength(follower: ObjectFollower): number {
  return follower.isBigFollower ? 2 : 1
}

function scoreOwnedObjects(
  objects: BaseObject[],
  playerId: number | string,
  weight: number,
  innsAndCathedralsEnabled: boolean
): number {
  return objects.reduce(
    (score, object) =>
      score +
      object.followers
        .filter((follower) => follower.playerId === playerId)
        .reduce(
          (strength, follower) =>
            strength +
            (innsAndCathedralsEnabled ? followerStrength(follower) : 1),
          0
        ) *
        weight,
    0
  )
}

export function calculateHeuristicScore(gameState: HeuristicGameState): number {
  const completedScore = Object.values(gameState.scores).reduce(
    (sum, value) => sum + value,
    0
  )

  const currentPlayer = gameState.currentPlayer
  if (!currentPlayer) return completedScore

  const temporaryObjects = gameState.temporaryObjects
  const weightedObjectGroups = [
    [temporaryObjects.cities, 2],
    [temporaryObjects.roads, 1],
    [temporaryObjects.monasteries, 3],
    [temporaryObjects.gardens, 3],
  ] as const

  return weightedObjectGroups.reduce(
    (score, [objects, weight]) =>
      score +
      scoreOwnedObjects(
        objects,
        currentPlayer.id,
        weight,
        gameState.rules.expansions.innsAndCathedrals
      ),
    completedScore
  )
}

export class GameSimulatorModule {
  private gameState: IGameBoard

  constructor(gameBoard: IGameBoard) {
    this.gameState = gameBoard.cloneForSimulation()
  }

  findBestMove(tile: Tile): SimulationResult {
    let bestScore = -Infinity
    let bestMoves: SimulationMove[] = []

    this.gameState.availablePlacesTiles.forEach(({ rowIndex, tileIndex }) => {
      for (let rotation = 0; rotation < 360; rotation += 90) {
        const turns = rotation / 90
        const rotatedTile: Tile = {
          ...tile,
          rotation: (tile.rotation + rotation) % 360,
          sides: rotateTileSides(tile.sides, turns),
          roadGroups: rotateTileGroups(tile.roadGroups, turns),
          cityGroups: rotateTileGroups(tile.cityGroups, turns),
          cityShieldGroups: rotateTileGroups(tile.cityShieldGroups, turns),
        }

        const snapshot = this.snapshotTilePlacement(
          this.gameState,
          rowIndex,
          tileIndex
        )
        try {
          if (
            !this.gameState.simulatePlaceTile(rotatedTile, rowIndex, tileIndex)
          ) {
            continue
          }

          // Оценка без подданного
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

          // Проверка фишек откатывается локально; доска и объекты не клонируются.
          for (const place of this.gameState.availableFollowersPlaces) {
            const followerTypes = this.getFollowerTypes(this.gameState, place)
            for (const followerType of followerTypes) {
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
                if (
                  !this.gameState.simulatePlaceFollower(place, followerType)
                ) {
                  continue
                }

                const score = calculateHeuristicScore(this.gameState)
                if (score > bestScore) {
                  bestScore = score
                  const followerPlacement = structuredClone({
                    point: place.point,
                    temporaryObject: placedObject,
                  })
                  bestMoves = [
                    {
                      tile: rotatedTile,
                      rowIndex,
                      tileIndex,
                      rotation: rotatedTile.rotation,
                      followerPlace: followerPlacement,
                      followerType,
                    },
                  ]
                }
              } finally {
                placedObject.followers.length = previousFollowersLength
                this.gameState.placedFollowers.length =
                  previousPlacedFollowersLength
                if (pool && previousPool) Object.assign(pool, previousPool)
              }
            }
          }
        } finally {
          this.restoreTilePlacement(
            this.gameState,
            rowIndex,
            tileIndex,
            snapshot
          )
        }
      }
    })

    return { score: bestScore, moves: bestMoves }
  }

  private getFollowerTypes(
    gameState: IGameBoard,
    place: AvailableFollowerPlace
  ): FollowerType[] {
    const pool = gameState.playersFollowers[gameState.currentPlayer?.id ?? '']
    const followerTypes: FollowerType[] = place.temporaryObject.isGarden
      ? []
      : [FollowerTypes.Follower]
    if (
      pool?.bigFollowers &&
      this.gameState.rules.expansions.innsAndCathedrals
    ) {
      followerTypes.push(FollowerTypes.BigFollower)
    }
    if (
      (place.temporaryObject.isMonastery || place.temporaryObject.isGarden) &&
      pool?.monks
    ) {
      followerTypes.push(FollowerTypes.Abbot)
    }
    return followerTypes
  }

  private snapshotTilePlacement(
    gameState: IGameBoard,
    rowIndex: number,
    tileIndex: number
  ): TileSimulationSnapshot {
    const row = gameState.tilePlacesStats[rowIndex]
    const temporaryObjects = gameState.temporaryObjects
    const completedObjects = gameState.completedObjects
    const scores = gameState.scores
    const placedFollowers = gameState.placedFollowers
    const playersFollowers = gameState.playersFollowers
    const availableFollowersPlaces = gameState.availableFollowersPlaces
    return {
      temporaryObjects,
      temporaryArrays: {
        cities: temporaryObjects.cities,
        roads: temporaryObjects.roads,
        monasteries: temporaryObjects.monasteries,
        gardens: temporaryObjects.gardens,
      },
      temporaryObjectState: structuredClone(temporaryObjects),
      completedObjects,
      completedArrays: {
        cities: completedObjects.cities,
        roads: completedObjects.roads,
        monasteries: completedObjects.monasteries,
        gardens: completedObjects.gardens,
      },
      completedObjectState: structuredClone(completedObjects),
      scores,
      scoreState: { ...scores },
      placedFollowers,
      placedFollowerState: placedFollowers.map((follower) => ({ ...follower })),
      playersFollowers,
      followerPoolState: structuredClone(playersFollowers),
      availableFollowersPlaces,
      availableFollowerState: [...availableFollowersPlaces],
      actionsHistoryLength: gameState.actionsHistory.length,
      placedTile: row?.[tileIndex],
      hadRow: row !== undefined,
    }
  }

  private restoreTilePlacement(
    gameState: IGameBoard,
    rowIndex: number,
    tileIndex: number,
    snapshot: TileSimulationSnapshot
  ): void {
    restoreObjectCollections(
      gameState.temporaryObjects,
      snapshot.temporaryArrays,
      snapshot.temporaryObjectState
    )
    restoreObjectCollections(
      gameState.completedObjects,
      snapshot.completedArrays,
      snapshot.completedObjectState
    )
    Object.assign(snapshot.scores, snapshot.scoreState)
    gameState.scores = snapshot.scores
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

function restoreObjectCollections(
  target: IGameBoard['temporaryObjects'],
  original: IGameBoard['temporaryObjects'],
  snapshot: IGameBoard['temporaryObjects']
): void {
  for (const key of ['cities', 'roads', 'monasteries', 'gardens'] as const) {
    const originalObjects = original[key]
    const snapshotObjects = snapshot[key]
    if (!originalObjects || !snapshotObjects) continue

    const originalById = new Map(
      originalObjects.map((object) => [object.id, object])
    )
    const restoredObjects = snapshotObjects.map((savedObject) => {
      const originalObject = originalById.get(savedObject.id)
      if (!originalObject) return savedObject

      Object.assign(originalObject, savedObject)
      originalObject.points = savedObject.points
      originalObject.followers = savedObject.followers
      return originalObject
    })

    originalObjects.splice(0, originalObjects.length, ...restoredObjects)
    target[key] = originalObjects
  }
}
