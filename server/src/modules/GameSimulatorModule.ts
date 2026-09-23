import type { IGameBoard } from './GameManager'
import type {
  AvailableFollowerPlace,
  FollowerType,
  ObjectFollower,
  Tile,
  TileSides,
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

function rotateSides(sides: TileSides, times: number): TileSides {
  let result = { ...sides }
  for (let i = 0; i < times; i++) {
    result = {
      north: result.west,
      east: result.north,
      south: result.east,
      west: result.south,
    }
  }
  return result
}

export class GameSimulatorModule {
  private gameState: IGameBoard
  private originalState: IGameBoard

  constructor(gameBoard: IGameBoard) {
    this.originalState = gameBoard
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

    const score = this.calculateScore(clonedGameState)

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
        const rotatedSides = rotateSides(tile.sides, turns)
        const rotatedTile: Tile = { ...tile, rotation, sides: rotatedSides }

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
          bestMoves = resultWithoutFollower.moves
        }

        // ... и для симуляции с подданным
        const gameState = this.gameState.clone()
        if (gameState.simulatePlaceTile(rotatedTile, rowIndex, tileIndex)) {
          for (const place of gameState.availableFollowersPlaces) {
            const followerTypes: FollowerType[] = ['follower']
            const pool =
              gameState.playersFollowers[gameState.currentPlayer?.id ?? '']
            if (place.temporaryObject.isMonastery && pool?.monks) {
              followerTypes.push('abbot')
            }

            for (const followerType of followerTypes) {
              const resultWithFollower = this.simulateMove(
                rotatedTile,
                rowIndex,
                tileIndex,
                rotation,
                place,
                gameState,
                followerType
              )
              if (resultWithFollower.score > bestScore) {
                bestScore = resultWithFollower.score
                bestMoves = resultWithFollower.moves
              }
            }
          }
        }
      }
    })

    return { score: bestScore, moves: bestMoves }
  }

  private calculateScore(gameState: IGameBoard): number {
    let score = Object.values(gameState.scores).reduce(
      (sum, value) => sum + value,
      0
    )

    const currentPlayer = gameState.currentPlayer
    if (!currentPlayer) return score

    // Бонус, если подданные ещё не выставлены
    if (gameState.playersFollowers[currentPlayer.id].ordinaryFollowers === 7) {
      return score + 10
    }

    const countPlayerObjects = (followers: ObjectFollower[]) =>
      new Set(
        followers
          .filter((f) => f.playerId === currentPlayer.id)
          .map((f) => f.objectId)
      ).size

    // Город
    for (const city of gameState.temporaryObjects.cities) {
      if (city.followers.some((f) => f.playerId === currentPlayer.id)) {
        score += 2 * countPlayerObjects(city.followers)
      }
    }
    // Дорога
    for (const road of gameState.temporaryObjects.roads) {
      if (road.followers.some((f) => f.playerId === currentPlayer.id)) {
        score += countPlayerObjects(road.followers)
      }
    }
    // Монастырь
    for (const monastery of gameState.temporaryObjects.monasteries) {
      if (monastery.followers.some((f) => f.playerId === currentPlayer.id)) {
        score += 3 * countPlayerObjects(monastery.followers)
      }
    }

    return score
  }
}
