import { type IGameBoard } from './GameManager.ts'
import type { Tile, Point, BaseObject } from './types.ts'

interface SimulationResult {
  score: number
  moves: {
    tile: Tile
    rowIndex: number
    tileIndex: number
    rotation: number
    followerPlace?: {
      point: Point
      temporaryObject: BaseObject
    }
  }[]
}

function rotateSides(sides: Tile['sides'], times: number): Tile['sides'] {
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

export interface IGameSimulator {
  gameState: IGameBoard
  originalState: IGameBoard
  simulateMove(
    tile: Tile,
    rowIndex: number,
    tileIndex: number,
    rotation: number,
    followerPlace?: { point: Point; temporaryObject: BaseObject },
    gameState?: IGameBoard
  ): SimulationResult
  findBestMove(tile: Tile, depth: number): SimulationResult
  calculateScore(gameState: IGameBoard): number
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
    followerPlace?: { point: Point; temporaryObject: BaseObject },
    gameState?: IGameBoard
  ): SimulationResult {
    // Create a copy of the game state
    const clonedGameState = gameState.clone()

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
      const followerPlaced =
        clonedGameState.simulatePlaceFollower(followerPlace)
      if (!followerPlaced) {
        return { score: -1, moves: [] }
      }
    }

    // Calculate the score for this move
    const score: number = this.calculateScore(clonedGameState)

    return {
      score,
      moves: [
        {
          tile,
          rowIndex,
          tileIndex,
          rotation,
          followerPlace,
        },
      ],
    }
  }

  findBestMove(tile: Tile): SimulationResult {
    let bestScore: number = -Infinity
    let bestMoves: SimulationResult['moves'] = []

    this.gameState.availablePlacesTiles?.forEach(({ rowIndex, tileIndex }) => {
      for (let rotation = 0; rotation < 360; rotation += 90) {
        const turns = rotation / 90
        const rotatedSides = rotateSides(tile.sides, turns)
        const rotatedTile: Tile = { ...tile, rotation, sides: rotatedSides }

        // Используем rotatedTile для симуляции
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

        // ... и для симуляции с фолловером
        const gameState = this.gameState.clone()
        if (gameState.simulatePlaceTile(rotatedTile, rowIndex, tileIndex)) {
          const availablePlaces = gameState.availableFollowersPlaces
          for (const place of availablePlaces) {
            const resultWithFollower = this.simulateMove(
              rotatedTile,
              rowIndex,
              tileIndex,
              rotation,
              place,
              gameState
            )
            if (resultWithFollower.score > bestScore) {
              bestScore = resultWithFollower.score
              bestMoves = resultWithFollower.moves
            }
          }
        }
      }
    })

    return {
      score: bestScore,
      moves: bestMoves,
    }
  }

  private calculateScore(gameState: IGameBoard): number {
    let score: number = Object.values(gameState.scores).reduce(
      (sum, score): number => sum + score,
      0
    )

    // --- Новый блок: бонус за продолжаемые объекты с нашими подданными ---
    const currentPlayer = gameState.currentPlayer

    if (
      currentPlayer &&
      gameState.playersFollowers[currentPlayer.id].ordinaryFollowers === 7
    ) {
      score += 10

      return score
    }
    if (currentPlayer) {
      // Город
      for (const city of gameState.temporaryObjects.cities) {
        if (city.followers?.some((f) => f.playerId === currentPlayer.id)) {
          // Например, +2 за каждый наш meeple в продолжаемом городе
          score +=
            2 *
            +new Set(
              city.followers
                .filter((f) => f.playerId === currentPlayer.id)
                .map((f) => f.objectId)
            ).size
        }
      }
      // Дорога
      for (const road of gameState.temporaryObjects.roads) {
        if (road.followers?.some((f) => f.playerId === currentPlayer.id)) {
          score +=
            1 *
            +new Set(
              road.followers
                .filter((f) => f.playerId === currentPlayer.id)
                .map((f) => f.objectId)
            ).size
        }
      }
      // Монастырь
      for (const monastery of gameState.temporaryObjects.monasteries) {
        if (monastery.followers?.some((f) => f.playerId === currentPlayer.id)) {
          score +=
            3 *
            +new Set(
              monastery.followers
                .filter((f) => f.playerId === currentPlayer.id)
                .map((f) => f.objectId)
            ).size
        }
      }
    }

    return score
  }
}
