import { describe, expect, it } from 'vitest'
import { GameManager } from '@server/modules/GameManager'
import {
  ActionTypes,
  FollowerType,
  ObjectTypes,
  PointDirection,
  TileId,
  TileSideType,
} from '@server/modules/types'
import type { AvailableFollowerPlace } from '@server/modules/GameManager'
import type { Tile, TileSides } from '@server/modules/types'
import { placeTileOnBoard } from '../helpers/board'
import { makePlayers } from '../helpers/fixtures'
import { FIELD_SIDES, sides } from '../helpers/tiles'

/**
 * Детерминированные тесты сада на «живом» GameManager: на сад ставится только
 * аббат (обычный подданный не допускается), при завершении сад очков не даёт,
 * а аббат отзывается владельцем за частичные очки. Наличие сада задаётся
 * определением тайла, а позиция в колоде остаётся случайной.
 */

const GARDEN_ROW = 16
const GARDEN_COL = 15

function gardenTile(): Tile {
  return {
    id: 'test-garden',
    rotation: 0,
    sides: FIELD_SIDES,
    hasGarden: true,
  }
}

const stashDeck = (game: GameManager) => {
  game.tilesList = [{ ...gardenTile(), id: 'test-field', hasGarden: false }]
}

function placeGarden(game: GameManager, row: number, col: number): boolean {
  return placeTileOnBoard(game, gardenTile(), row, col)
}

function placeTileWithSides(
  game: GameManager,
  tileSides: TileSides,
  row: number,
  col: number
): boolean {
  return placeTileOnBoard(
    game,
    { id: 'test', rotation: 0, sides: tileSides },
    row,
    col
  )
}

function placeFieldTile(game: GameManager, row: number, col: number): boolean {
  return placeTileWithSides(game, FIELD_SIDES, row, col)
}

/** Единственное доступное место на саду */
function gardenPlaceOf(game: GameManager): AvailableFollowerPlace {
  const place = game.availableFollowersPlaces.find(
    (candidate) => candidate.temporaryObject.isGarden
  )
  if (!place) throw new Error('Garden place is missing')
  return place
}

/** Общая подготовка проверок сада: тайл с садом и аббат на нём */
function placeGardenWithAbbot(game: GameManager): AvailableFollowerPlace {
  stashDeck(game)
  expect(placeGarden(game, GARDEN_ROW, GARDEN_COL)).toBe(true)
  const gardenPlace = gardenPlaceOf(game)
  stashDeck(game)
  game.placeFollower(gardenPlace, FollowerType.Abbot)
  return gardenPlace
}

/**
 * Завершает сад: кладёт тайлы по кругу за двоих игроков, пропуская фишки.
 * Допустимые клетки и повороты подобраны так, чтобы каждый тайл примыкал к
 * уже выложенным и не требовал фишек.
 */
function completeGarden(game: GameManager): void {
  const turns: Array<{ row: number; col: number; sides?: TileSides }> = [
    { row: 16, col: 14 },
    { row: 17, col: 15 },
    { row: 16, col: 16 },
    {
      row: 15,
      col: 16,
      sides: sides(
        TileSideType.Field,
        TileSideType.Field,
        TileSideType.Field,
        TileSideType.Road
      ),
    },
    {
      row: 15,
      col: 14,
      sides: sides(
        TileSideType.Road,
        TileSideType.Road,
        TileSideType.Field,
        TileSideType.Field
      ),
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
    expect(placeGarden(game, GARDEN_ROW, GARDEN_COL)).toBe(true)
    expect(game.isPlacingFollower).toBe(true)

    const gardenPlace = gardenPlaceOf(game)
    expect(gardenPlace.point.direction).toBe(PointDirection.Center)

    // Обычный подданный на сад не ставится: ход пропускается, фишка не списана
    stashDeck(game)
    game.availableFollowersPlaces = [gardenPlace]
    game.placeFollower(gardenPlace, FollowerType.Follower)
    expect(game.playersFollowers[1]).toEqual({
      ordinaryFollowers: 7,
      monks: 1,
    })
    expect(game.placedFollowers).toHaveLength(0)
    expect(game.currentPlayer!.id).toBe(2)
  })

  it('сад не предлагается, если в запасе нет аббата: ход сразу завершается', () => {
    const game = new GameManager({ players: makePlayers() })
    game.playersFollowers[1].monks = 0

    stashDeck(game)
    expect(placeGarden(game, GARDEN_ROW, GARDEN_COL)).toBe(true)

    // Все стороны тайла — поле, поэтому единственное место (сад) отпадает
    expect(game.availableFollowersPlaces).toEqual([])
    expect(game.isPlacingFollower).toBe(false)
    expect(game.playersFollowers[1]).toEqual({
      ordinaryFollowers: 7,
      monks: 0,
    })
    expect(game.currentPlayer!.id).toBe(2)
  })

  it('аббат ставится на сад и списывает пул monks', () => {
    const game = new GameManager({ players: makePlayers() })

    const gardenPlace = placeGardenWithAbbot(game)

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

    const gardenPlace = placeGardenWithAbbot(game)
    completeGarden(game)

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

    placeGardenWithAbbot(game)

    expect(game.currentPlayer!.id).toBe(2)
    stashDeck(game)
    expect(
      placeTileWithSides(
        game,
        sides(
          TileSideType.Field,
          TileSideType.Field,
          TileSideType.City,
          TileSideType.Road
        ),
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
