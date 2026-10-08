import { describe, expect, it } from 'vitest'
import { GameManager } from '@server/modules/GameManager'
import {
  ActionTypes,
  FollowerType,
  ObjectTypes,
  PointDirection,
  SideName,
  TileId,
  TileSideType,
} from '@server/modules/types'
import type { Player, Tile, TileSides } from '@server/modules/types'

/**
 * Детерминированные тесты сада на «живом» GameManager: на сад ставится только
 * аббат (обычный подданный не допускается), при завершении сад очков не даёт,
 * а аббат отзывается владельцем за частичные очки. Наличие сада задаётся
 * определением тайла, а позиция в колоде остаётся случайной.
 */

function gardenTile(): Tile {
  return {
    id: 'test-garden',
    rotation: 0,
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    },
    hasGarden: true,
  }
}

function makePlayers(): Player[] {
  return [
    {
      id: 1,
      name: 'Alice',
      color: 'red',
      score: 0,
      socketId: 's1',
      deviceId: 'd1',
    },
    {
      id: 2,
      name: 'Bob',
      color: 'blue',
      score: 0,
      socketId: 's2',
      deviceId: 'd2',
    },
  ]
}

const stashDeck = (game: GameManager) => {
  game.tilesList = [{ ...gardenTile(), id: 'test-field', hasGarden: false }]
}

function placeGarden(game: GameManager, row: number, col: number): boolean {
  game.currentTile = { ...gardenTile(), x: col, y: row }
  return game.placeTile(game.currentTile, row, col)
}

function placeTileWithSides(
  game: GameManager,
  sides: TileSides,
  row: number,
  col: number
): boolean {
  const tile: Tile = { id: 'test', rotation: 0, sides }
  game.currentTile = { ...tile, x: col, y: row }
  return game.placeTile(game.currentTile, row, col)
}

function placeFieldTile(game: GameManager, row: number, col: number): boolean {
  const tile: Tile = {
    id: 'test-field',
    rotation: 0,
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    },
  }
  game.currentTile = { ...tile, x: col, y: row }
  return game.placeTile(game.currentTile, row, col)
}

function currentScore(game: GameManager, playerId: number): number {
  return game.scores[playerId] ?? 0
}

describe('Сад (оба игрока-человека, фиксированная доска)', () => {
  it('добавляет сады дополнения в колоду вместе с базовыми садами', () => {
    const game = new GameManager({
      players: makePlayers(),
      innsAndCathedralsEnabled: true,
    })
    const gardenTiles = [...game.tilesList, ...game.tileHistory].filter(
      (tile) => tile.hasGarden
    )
    const counts: Record<string, number> = {}
    for (const tile of gardenTiles) {
      counts[tile.id] = (counts[tile.id] ?? 0) + 1
    }

    expect(gardenTiles).toHaveLength(7)
    expect(counts).toMatchObject({ [TileId.IAC_B]: 1, [TileId.IAC_H]: 1 })
  })

  it('на сад ставится только аббат: обычный подданный отклоняется', () => {
    const game = new GameManager({ players: makePlayers() })

    stashDeck(game)
    expect(placeGarden(game, 16, 15)).toBe(true)
    expect(game.isPlacingFollower).toBe(true)

    const gardenPlace = game.availableFollowersPlaces.find(
      (place) => place.temporaryObject.isGarden
    )
    expect(gardenPlace).toBeTruthy()
    expect(gardenPlace!.point.direction).toBe(PointDirection.Center)

    // Обычный подданный на сад не ставится: ход пропускается, фишка не списана
    stashDeck(game)
    game.availableFollowersPlaces = [gardenPlace!]
    game.placeFollower(gardenPlace!, FollowerType.Follower)
    expect(game.playersFollowers[1]).toEqual({
      ordinaryFollowers: 7,
      monks: 1,
    })
    expect(game.placedFollowers).toHaveLength(0)
    expect(game.currentPlayer!.id).toBe(2)
  })

  it('аббат ставится на сад и списывает пул monks', () => {
    const game = new GameManager({ players: makePlayers() })

    stashDeck(game)
    expect(placeGarden(game, 16, 15)).toBe(true)
    const gardenPlace = game.availableFollowersPlaces.find(
      (place) => place.temporaryObject.isGarden
    )!
    stashDeck(game)
    game.placeFollower(gardenPlace, FollowerType.Abbot)

    expect(game.playersFollowers[1]).toEqual({
      ordinaryFollowers: 7,
      monks: 0,
    })

    const abbot = game.placedFollowers.find(
      (follower) => follower.playerId === 1 && follower.isAbbot
    )
    expect(abbot).toBeTruthy()
    expect(abbot!.objectId).toBe(gardenPlace.temporaryObject.id)
    expect(abbot!.isGarden).toBe(true)

    expect(game.currentPlayer!.id).toBe(2)
  })

  it('завершённый сад с аббатом очков не даёт, аббат ждёт отзыва', () => {
    const game = new GameManager({ players: makePlayers() })

    stashDeck(game)
    expect(placeGarden(game, 16, 15)).toBe(true)
    const gardenPlace = game.availableFollowersPlaces.find(
      (place) => place.temporaryObject.isGarden
    )!
    stashDeck(game)
    game.placeFollower(gardenPlace, FollowerType.Abbot)

    const turns: Array<{ row: number; col: number; sides?: TileSides }> = [
      { row: 16, col: 14 },
      { row: 17, col: 15 },
      { row: 16, col: 16 },
      {
        row: 15,
        col: 16,
        sides: {
          [SideName.North]: TileSideType.Field,
          [SideName.East]: TileSideType.Field,
          [SideName.South]: TileSideType.Field,
          [SideName.West]: TileSideType.Road,
        },
      },
      {
        row: 15,
        col: 14,
        sides: {
          [SideName.North]: TileSideType.Road,
          [SideName.East]: TileSideType.Road,
          [SideName.South]: TileSideType.Field,
          [SideName.West]: TileSideType.Field,
        },
      },
      { row: 17, col: 14 },
      { row: 17, col: 16 },
    ]

    for (const [turnIndex, turn] of turns.entries()) {
      stashDeck(game)
      game.players = [...game.players.slice(0, 2)]
      game.currentPlayer = game.players[turnIndex % 2 === 0 ? 1 : 0] ?? null
      game.currentPlayerIndex = turnIndex % 2 === 0 ? 1 : 0
      const placed = turn.sides
        ? placeTileWithSides(game, turn.sides, turn.row, turn.col)
        : placeFieldTile(game, turn.row, turn.col)
      expect(
        placed,
        `failed synthetic turn ${turnIndex}: ${turn.row},${turn.col}, grid=${JSON.stringify(game.tilePlacesStats)}`
      ).toBe(true)
      if (game.isPlacingFollower) {
        stashDeck(game)
        game.skipFollower()
      }
    }

    // Завершение сада очков не начислило, аббат остался на доске
    expect(currentScore(game, 1)).toBe(0)
    expect(
      game.placedFollowers.find(
        (follower) => follower.playerId === 1 && follower.isAbbot
      )
    ).toBeTruthy()

    const completedGarden = game.completedObjects.gardens.find(
      (garden) => garden.id === gardenPlace.temporaryObject.id
    )
    expect(completedGarden).toBeTruthy()
  })

  it('отзыв аббата с сада начисляет частичные очки и возвращает фишку', () => {
    const game = new GameManager({ players: makePlayers() })

    stashDeck(game)
    expect(placeGarden(game, 16, 15)).toBe(true)
    const gardenPlace = game.availableFollowersPlaces.find(
      (place) => place.temporaryObject.isGarden
    )!
    stashDeck(game)
    game.placeFollower(gardenPlace, FollowerType.Abbot)

    expect(game.currentPlayer!.id).toBe(2)
    stashDeck(game)
    expect(
      placeTileWithSides(
        game,
        {
          [SideName.North]: TileSideType.Field,
          [SideName.East]: TileSideType.Field,
          [SideName.South]: TileSideType.City,
          [SideName.West]: TileSideType.Road,
        },
        14,
        15
      )
    ).toBe(true)
    stashDeck(game)
    game.skipFollower()

    expect(game.currentPlayer!.id).toBe(1)
    expect(game.recallAbbot()).toBe(true)

    // Сад (16,15) + стартовый D (15,15) = 2 очка
    expect(currentScore(game, 1)).toBe(2)
    expect(game.playersFollowers[1].monks).toBe(1)
    expect(
      game.placedFollowers.some(
        (follower) => follower.playerId === 1 && follower.isAbbot
      )
    ).toBe(false)

    const scoring = game.actionsHistory.filter(
      (action) => action.actionType === ActionTypes.ADDING_SCORES
    )
    expect(
      (scoring[0].actionData as { objectType: ObjectTypes }).objectType
    ).toBe(ObjectTypes.GARDEN)
  })
})
