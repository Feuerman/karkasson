import type { IGameBoard } from './GameManager'
import type {
  AvailableFollowerPlace,
  BaseObject,
  FollowerType,
  ObjectFollower,
  Tile,
} from './types'
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

type HeuristicGameState = Pick<
  IGameBoard,
  'scores' | 'currentPlayer' | 'temporaryObjects'
>

function countOwnedObjectIds(
  followers: ObjectFollower[],
  playerId: number | string
): number {
  return new Set(
    followers
      .filter((follower) => follower.playerId === playerId)
      .map((follower) => follower.objectId)
  ).size
}

function scoreOwnedObjects(
  objects: BaseObject[],
  playerId: number | string,
  weight: number
): number {
  return objects.reduce(
    (score, object) =>
      score + countOwnedObjectIds(object.followers, playerId) * weight,
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
      score + scoreOwnedObjects(objects, currentPlayer.id, weight),
    completedScore
  )
}

export class GameSimulatorModule {
  private gameState: IGameBoard

  constructor(gameBoard: IGameBoard) {
    this.gameState = gameBoard.clone()
  }

  simulateMove(
    tile: Tile,
    rowIndex: number,
    tileIndex: number,
    rotation: number,
    followerPlace?: AvailableFollowerPlace,
    gameState?: IGameBoard,
    followerType: FollowerType = 'follower'
  ): SimulationResult {
    // Create a copy of the game state
    const clonedGameState = (gameState ?? this.gameState).clone()

    // Try to place the tile
    const tilePlaced = clonedGameState.simulatePlaceTile(
      tile,
      rowIndex,
      tileIndex
    )
    if (!tilePlaced) {
      return { score: -1, moves: [] }
    }

    // If follower placement is specified, try to place it
    if (followerPlace) {
      const followerPlaced = clonedGameState.simulatePlaceFollower(
        followerPlace,
        followerType
      )
      if (!followerPlaced) {
        return { score: -1, moves: [] }
      }
    }

    const score = calculateHeuristicScore(clonedGameState)

    return {
      score,
      moves: [
        { tile, rowIndex, tileIndex, rotation, followerPlace, followerType },
      ],
    }
  }

  findBestMove(tile: Tile): SimulationResult {
    let bestScore = -Infinity
    let bestMoves: SimulationMove[] = []

    this.gameState.availablePlacesTiles.forEach(({ rowIndex, tileIndex }) => {
      for (let rotation = 0; rotation < 360; rotation += 90) {
        const turns = rotation / 90
        const rotatedSides = rotateTileSides(tile.sides, turns)
        const rotatedTile: Tile = {
          ...tile,
          rotation: (tile.rotation + rotation) % 360,
          sides: rotatedSides,
          roadGroups: rotateTileGroups(tile.roadGroups, turns),
          cityGroups: rotateTileGroups(tile.cityGroups, turns),
        }

        // Сначала оцениваем ход без подданного
        const resultWithoutFollower = this.simulateMove(
          rotatedTile,
          rowIndex,
          tileIndex,
          rotation,
          undefined,
          this.gameState
        )
        if (resultWithoutFollower.score > bestScore) {
          bestScore = resultWithoutFollower.score
          bestMoves = resultWithoutFollower.moves.map((move) => ({
            ...move,
            rotation: (tile.rotation + rotation) % 360,
          }))
        }

        // ... и для симуляции с подданным. Тайла здесь уже стоит на доске:
        // повторная попытка simulateMove размещает его второй раз в ту же
        // клетку, поэтому фишку нужно симулировать непосредственно в этом
        // состоянии.
        const gameState = this.gameState.clone()
        if (gameState.simulatePlaceTile(rotatedTile, rowIndex, tileIndex)) {
          for (const place of gameState.availableFollowersPlaces) {
            const pool =
              gameState.playersFollowers[gameState.currentPlayer?.id ?? '']
            const followerTypes: FollowerType[] = place.temporaryObject.isGarden
              ? []
              : ['follower']
            if (
              (place.temporaryObject.isMonastery ||
                place.temporaryObject.isGarden) &&
              pool?.monks
            ) {
              followerTypes.push('abbot')
            }

            for (const followerType of followerTypes) {
              const stateWithFollower = gameState.clone()
              if (
                !stateWithFollower.simulatePlaceFollower(place, followerType)
              ) {
                continue
              }

              const score = calculateHeuristicScore(stateWithFollower)
              if (score <= bestScore) continue

              bestScore = score
              bestMoves = [
                {
                  tile: rotatedTile,
                  rowIndex,
                  tileIndex,
                  rotation: (tile.rotation + rotation) % 360,
                  followerPlace: {
                    point: place.point,
                    temporaryObject: { ...place.temporaryObject },
                  },
                  followerType,
                },
              ]
            }
          }
        }
      }
    })

    return { score: bestScore, moves: bestMoves }
  }
}
