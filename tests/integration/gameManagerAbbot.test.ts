import { describe, expect, it } from 'vitest'
import { GameManager } from '../../server/src/modules/GameManager'
import { ActionTypes, ObjectTypes } from '../../server/src/modules/types'
import type { Player, Tile, TileSides } from '../../server/src/modules/types'

/**
 * Детерминированные тесты аббата на «живом» GameManager: колода и координаты
 * ходов фиксированы, поэтому здесь не работает случайность, а правила
 * (постановка, отзыв, завершение монастыря с аббатом) проверяются по факту.
 */

function monasteryTile(): Tile {
  return {
    id: 'B',
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_B.png',
    rotation: 0,
    sides: { north: 'field', east: 'field', south: 'field', west: 'field' },
    isMonastery: true,
  }
}

// «Монастырь с дорогой»: даёт и объект-монастырь, и дорогу
function monasteryWithRoadTile(): Tile {
  return {
    id: 'A',
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_A.png',
    rotation: 0,
    sides: { north: 'field', east: 'field', south: 'road', west: 'field' },
    isMonastery: true,
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

// Обеспечивает непустую колоду к моменту отрисовки следующего тайла в endTurn
const stashDeck = (game: GameManager) => {
  game.tilesList = [monasteryTile()]
}

// Ставит тайл и «прокручивает» его как currentTile, иначе серверный
// checkAvailableFollowers не увидит тайл и не предложит фишку.
function placeMonastery(game: GameManager, row: number, col: number): boolean {
  game.currentTile = { ...monasteryTile(), x: col, y: row }
  return game.placeTile(game.currentTile, row, col)
}

function placeMonasteryWithRoad(game: GameManager): boolean {
  const tile = { ...monasteryWithRoadTile(), x: 15, y: 16 }
  game.currentTile = tile
  return game.placeTile(tile, 16, 15)
}

// Ставит тайл с заданными сторонами и «прокручивает» его как currentTile.
// Нужен там, где сосед — стартовый E (у него дорожные/городские стороны).
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

function currentScore(game: GameManager, playerId: number): number {
  return game.scores[playerId] ?? 0
}

describe('Аббат (оба игрока-человека, фиксированная доска)', () => {
  it('аббат ставится только на монастырь и списывает пул monks, а не обычных фишек', () => {
    const game = new GameManager({ players: makePlayers() })

    stashDeck(game)
    // Стартовый тайл E на (15,15); ставим монастырь B под ним
    expect(placeMonastery(game, 16, 15)).toBe(true)
    expect(game.isPlacingFollower).toBe(true)

    const monasteryPlace = game.availableFollowersPlaces.find(
      (place) => place.temporaryObject.isMonastery
    )
    expect(monasteryPlace).toBeTruthy()

    expect(game.playersFollowers[1]).toEqual({
      ordinaryFollowers: 7,
      monks: 1,
    })

    stashDeck(game)
    game.placeFollower(monasteryPlace!, 'abbot')

    // Аббат списан, обычные фишки не тронуты
    expect(game.playersFollowers[1]).toEqual({
      ordinaryFollowers: 7,
      monks: 0,
    })

    const abbot = game.placedFollowers.find(
      (follower) => follower.playerId === 1 && follower.isAbbot
    )
    expect(abbot).toBeTruthy()
    expect(abbot!.objectId).toBe(monasteryPlace!.temporaryObject.id)

    // Объект-монастырь получил аббата
    expect(game.temporaryObjects.monasteries[0].followers).toContainEqual(
      expect.objectContaining({ playerId: 1, isAbbot: true })
    )

    // История действий содержит PLACE_FOLLOWER с типом «аббат»
    const action = game.actionsHistory[game.actionsHistory.length - 1]
    expect(action!.actionType).toBe(ActionTypes.PLACE_FOLLOWER)
    expect((action!.actionData as { followerType: string }).followerType).toBe(
      'abbot'
    )

    // Ход завершился и передан Бобу
    expect(game.currentPlayer!.id).toBe(2)
  })

  it('аббат не ставится на дорогу: ход пропускается, пул monks не тратится', () => {
    const game = new GameManager({ players: makePlayers() })

    stashDeck(game)
    // «Монастырь с дорогой»: дорога ведёт вниз, монастырь по центру
    expect(placeMonasteryWithRoad(game)).toBe(true)

    const roadPlace = game.availableFollowersPlaces.find(
      (place) => place.point.pointType === 'road'
    )
    const monasteryPlace = game.availableFollowersPlaces.find(
      (place) => place.temporaryObject.isMonastery
    )
    expect(roadPlace).toBeTruthy()
    expect(monasteryPlace).toBeTruthy()

    stashDeck(game)
    // Попытка поставить аббата на дорогу (не монастырь)
    game.placeFollower(roadPlace!, 'abbot')

    expect(game.playersFollowers[1]).toEqual({
      ordinaryFollowers: 7,
      monks: 1,
    })
    expect(game.placedFollowers.some((follower) => follower.isAbbot)).toBe(
      false
    )
    // Провальная валидация завершила ход
    expect(game.currentPlayer!.id).toBe(2)
  })

  it('отзыв аббата начисляет частичные очки и возвращает фишку без расхода хода', () => {
    const game = new GameManager({ players: makePlayers() })

    // Ход Алисы 1: монастырь B (16,15) + аббат
    stashDeck(game)
    expect(placeMonastery(game, 16, 15)).toBe(true)
    const monasteryPlace = game.availableFollowersPlaces.find(
      (place) => place.temporaryObject.isMonastery
    )!
    stashDeck(game)
    game.placeFollower(monasteryPlace, 'abbot')

    // Ход Боба 1: тайл в стороне от 3×3 аббата — (14,15), севернее E.
    // У стартового E north = city, поэтому юг тайла — город; западный тупик
    // дороги оставляет предложение фишки, чтобы ход завершался через skip.
    expect(game.currentPlayer!.id).toBe(2)
    stashDeck(game)
    expect(
      placeTileWithSides(
        game,
        { north: 'field', east: 'field', south: 'city', west: 'road' },
        14,
        15
      )
    ).toBe(true)
    stashDeck(game)
    game.skipFollower()

    // Ход Алисы 2: отзываем аббата, не ставя тайл
    expect(game.currentPlayer!.id).toBe(1)
    expect(currentScore(game, 1)).toBe(0)

    const recalled = game.recallAbbot()
    expect(recalled).toBe(true)

    // Очки: сам монастырь (16,15) + стартовый E (15,15) — 2 очка
    expect(currentScore(game, 1)).toBe(2)
    expect(game.playersFollowers[1]).toEqual({
      ordinaryFollowers: 7,
      monks: 1,
    })
    expect(
      game.placedFollowers.some(
        (follower) => follower.playerId === 1 && follower.isAbbot
      )
    ).toBe(false)
    expect(game.temporaryObjects.monasteries[0].followers).toHaveLength(0)

    // История: ADDING_SCORES + BACK_FOLLOWER
    const scoring = game.actionsHistory.filter(
      (action) => action.actionType === ActionTypes.ADDING_SCORES
    )
    expect(scoring).toHaveLength(1)
    const data = scoring[0].actionData as {
      objectType: ObjectTypes
      objectId?: string
      score: { total: number }
    }
    expect(data.objectType).toBe(ObjectTypes.MONASTERY)
    expect(data.score.total).toBe(2)
    expect(
      game.actionsHistory.some(
        (action) => action.actionType === ActionTypes.BACK_FOLLOWER
      )
    ).toBe(true)

    // Ход не расходуется: по-прежнему ход Алисы
    expect(game.currentPlayer!.id).toBe(1)
  })

  it('повторный отзыв без аббата на доске вернуть нечего', () => {
    const game = new GameManager({ players: makePlayers() })

    expect(game.recallAbbot()).toBe(false)

    // У Боба аббата тоже нет на доске
    game.currentPlayerIndex = 1
    game.currentPlayer = game.players[1]
    expect(game.recallAbbot()).toBe(false)
  })

  it('завершённый монастырь с аббатом очков не даёт, аббат ждёт отзыва', () => {
    const game = new GameManager({ players: makePlayers() })

    // Ход 1 (Алиса): B (16,15) + аббат
    stashDeck(game)
    expect(placeMonastery(game, 16, 15)).toBe(true)
    const monasteryPlace = game.availableFollowersPlaces.find(
      (place) => place.temporaryObject.isMonastery
    )!
    stashDeck(game)
    game.placeFollower(monasteryPlace, 'abbot')

    // Заполняем 3×3 вокруг аббата: ходы чередуются, Боб и Алиса
    // просто пропускают выставление фишек.
    const turns: Array<{ row: number; col: number; sides?: TileSides }> = [
      { row: 16, col: 14 }, // Боб
      { row: 17, col: 15 }, // Алиса
      { row: 16, col: 16 }, // Боб
      {
        row: 15,
        col: 16,
        sides: { north: 'field', east: 'field', south: 'field', west: 'road' },
      }, // Алиса (у E east = road)
      {
        row: 15,
        col: 14,
        sides: { north: 'road', east: 'road', south: 'field', west: 'field' },
      }, // Боб (у E west = road; северный тупик держит дорогу открытой)
      { row: 17, col: 14 }, // Алиса
      { row: 17, col: 16 }, // Боб — последняя клетка 3×3, монастырь завершён
    ]

    for (let i = 0; i < turns.length; i++) {
      const expectedPlayer = i % 2 === 0 ? 2 : 1
      expect(game.currentPlayer!.id).toBe(expectedPlayer)

      const turn = turns[i]
      stashDeck(game)
      const placed = turn.sides
        ? placeTileWithSides(game, turn.sides, turn.row, turn.col)
        : placeMonastery(game, turn.row, turn.col)
      expect(placed).toBe(true)
      stashDeck(game)
      game.skipFollower()
    }

    // Завершение НЕ начислило очков Алисе и не вернуло аббата
    expect(currentScore(game, 1)).toBe(0)
    expect(
      game.placedFollowers.find(
        (follower) => follower.playerId === 1 && follower.isAbbot
      )
    ).toBeTruthy()

    // Аббат остался в завершённом объекте
    const completedMonastery = game.completedObjects.monasteries.find((m) =>
      m.followers.some(
        (follower) => follower.playerId === 1 && follower.isAbbot
      )
    )
    expect(completedMonastery).toBeTruthy()

    // Ход Алисы: отзыв с завершённого монастыря даёт полные 9 очков (3×3)
    expect(game.currentPlayer!.id).toBe(1)
    expect(game.recallAbbot()).toBe(true)
    expect(currentScore(game, 1)).toBe(9)
    expect(game.playersFollowers[1].monks).toBe(1)
    expect(completedMonastery!.followers).toHaveLength(0)
  })
})
