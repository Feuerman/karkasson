import { describe, expect, it } from 'vitest'
import { GameManager } from '@server/modules/GameManager'
import { scoreFields } from '@server/modules/finalScoring'
import type { GameAction } from '@server/modules/gameActions'
import {
  ActionTypes,
  FollowerType,
  ObjectTypes,
  SideName,
  TileSideType,
  type BaseObject,
  type FieldFollower,
  type GridTile,
} from '@server/modules/types'
import {
  fields,
  field,
  wholeTileField,
  type TileFieldTopology,
} from '@server/data/fieldTopology'
import { makePlayers, gridTile } from '../helpers/fixtures'

const players = makePlayers()
const P1 = players[0].id
const P2 = players[1].id

const allFieldSides: Record<SideName, TileSideType> = {
  [SideName.North]: TileSideType.Field,
  [SideName.East]: TileSideType.Field,
  [SideName.South]: TileSideType.Field,
  [SideName.West]: TileSideType.Field,
}

function fieldTile(
  rowIndex: number,
  tileIndex: number,
  topology: TileFieldTopology,
  sides: Partial<Record<SideName, TileSideType>> = {}
): GridTile {
  return {
    id: 'test',
    rotation: 0,
    x: tileIndex,
    y: rowIndex,
    rowIndex,
    tileIndex,
    sides: { ...allFieldSides, ...sides },
    fieldTopology: topology,
  } as unknown as GridTile
}

function city(
  id: string,
  points: BaseObject['points'],
  playerIds: number[]
): BaseObject {
  return {
    id,
    points,
    followers: playerIds.map((playerId) => ({
      playerId,
      objectId: id,
      point: points[0] ?? { x: 0, y: 0 },
    })),
  }
}

function peasant(
  playerId: number | string,
  rowIndex: number,
  tileIndex: number,
  regionIndex: number,
  isBig = false
): FieldFollower {
  return {
    playerId,
    isBigFollower: isBig || undefined,
    point: {
      x: tileIndex,
      y: rowIndex,
      rowIndex,
      tileIndex,
      regionIndex,
      pointType: TileSideType.Field,
    },
  }
}

function setupGame(params: {
  innsAndCathedrals?: boolean
  finalScoring?: boolean
}): GameManager {
  const game = new GameManager({
    players,
    startImmediately: false,
    innsAndCathedralsEnabled: params.innsAndCathedrals ?? false,
    finalScoringEnabled: params.finalScoring ?? false,
  })
  game.temporaryObjects = {
    cities: [],
    roads: [],
    monasteries: [],
    gardens: [],
  }
  game.completedObjects = {
    cities: [],
    roads: [],
    monasteries: [],
    gardens: [],
  }
  game.tilePlacesStats = {}
  return game
}

function usePlayer(game: GameManager, index: number): void {
  game.currentPlayer = game.players[index] ?? null
  game.currentPlayerIndex = index
}

function fieldScoreActions(game: GameManager) {
  return game.actionsHistory.filter(
    (
      action
    ): action is Extract<
      GameAction,
      { actionType: ActionTypes.ADDING_SCORES }
    > =>
      action.actionType === ActionTypes.ADDING_SCORES &&
      action.actionData.objectType === ObjectTypes.FIELD
  )
}

describe('Постановка крестьянина на поле', () => {
  it('доступно свободное поле на тайле', () => {
    const game = setupGame({})
    usePlayer(game, 0)
    const tile = fieldTile(10, 10, wholeTileField())
    game.tilePlacesStats = { 10: { 10: tile } }
    game.currentTile = tile

    const places = game.findAvailableFieldPlaces(tile)
    expect(places).toHaveLength(1)
    expect(places[0]?.point.regionIndex).toBe(0)

    const placed = game.placeFieldFollower(places[0], FollowerType.Follower)
    expect(placed).toBe(FollowerType.Follower)
    expect(game.fieldFollowers).toHaveLength(1)
    expect(game.fieldFollowers[0]?.playerId).toBe(P1)
    expect(game.playersFollowers[P1].ordinaryFollowers).toBe(6)
    // Крестьянин остаётся на поле и не возвращается в запас.
    expect(game.fieldFollowers).toHaveLength(1)
  })

  it('большой подданный расходуется и помечается', () => {
    const game = setupGame({ innsAndCathedrals: true })
    usePlayer(game, 0)
    const tile = fieldTile(10, 10, wholeTileField())
    game.tilePlacesStats = { 10: { 10: tile } }
    game.currentTile = tile

    const placed = game.placeFieldFollower(
      game.findAvailableFieldPlaces(tile)[0],
      FollowerType.BigFollower
    )
    expect(placed).toBe(FollowerType.BigFollower)
    expect(game.fieldFollowers[0]?.isBigFollower).toBe(true)
    expect(game.playersFollowers[P1].bigFollowers).toBe(0)
  })

  it('занятая компонента поля недоступна для другого крестьянина', () => {
    const game = setupGame({})
    usePlayer(game, 0)
    const tile = fieldTile(10, 10, wholeTileField())
    game.tilePlacesStats = { 10: { 10: tile } }
    game.currentTile = tile

    game.placeFieldFollower(
      game.findAvailableFieldPlaces(tile)[0],
      FollowerType.Follower
    )
    const placed = game.placeFieldFollower(
      game.findAvailableFieldPlaces(tile)[0],
      FollowerType.Follower
    )
    expect(placed).toBeUndefined()
    expect(game.fieldFollowers).toHaveLength(1)
  })

  it('два не connected поля могут быть заняты по одному крестьянину', () => {
    const game = setupGame({})
    usePlayer(game, 0)
    const tileA = fieldTile(10, 10, wholeTileField())
    const tileB = fieldTile(20, 20, wholeTileField())
    game.tilePlacesStats = { 10: { 10: tileA }, 20: { 20: tileB } }
    game.currentTile = tileA

    const placesA = game.findAvailableFieldPlaces(tileA)
    game.placeFieldFollower(placesA[0], FollowerType.Follower)

    game.currentTile = tileB
    usePlayer(game, 1)
    const placesB = game.findAvailableFieldPlaces(tileB)
    expect(placesB).toHaveLength(1)
    const placed = game.placeFieldFollower(placesB[0], FollowerType.Follower)
    expect(placed).toBe(FollowerType.Follower)
    expect(game.fieldFollowers).toHaveLength(2)
  })

  it('две соединённые клетки поля — одна занятая компонента', () => {
    const game = setupGame({})
    usePlayer(game, 0)
    const tileA = fieldTile(10, 10, wholeTileField())
    const tileB = fieldTile(10, 11, wholeTileField())
    game.tilePlacesStats = { 10: { 10: tileA, 11: tileB } }
    game.currentTile = tileA

    game.placeFieldFollower(
      game.findAvailableFieldPlaces(tileA)[0],
      FollowerType.Follower
    )

    // tileB в той же связной компоненте: свободных мест нет.
    game.currentTile = tileB
    usePlayer(game, 1)
    expect(game.findAvailableFieldPlaces(tileB)).toHaveLength(0)
    // Прямая постановка на занятую компоненту тоже отвергается сервером.
    const placed = game.placeFieldFollower(
      {
        point: {
          x: 11,
          y: 10,
          rowIndex: 10,
          tileIndex: 11,
          regionIndex: 0,
          pointType: TileSideType.Field,
        },
      },
      FollowerType.Follower
    )
    expect(placed).toBeUndefined()
    expect(game.fieldFollowers).toHaveLength(1)
  })
})

describe('Финальный подсчёт полей', () => {
  it('лидер получает 3 очка за каждый соприкасающийся завершённый город', () => {
    const game = setupGame({ finalScoring: true })
    const fieldTileA = fieldTile(10, 10, fields(field(['eastNorth'])), {
      [SideName.East]: TileSideType.Field,
    })
    const cityTileB = gridTile({
      x: 11,
      y: 10,
      rowIndex: 10,
      tileIndex: 11,
      id: 'B',
      sides: { ...allFieldSides, [SideName.West]: TileSideType.City },
    })
    game.tilePlacesStats = { 10: { 10: fieldTileA, 11: cityTileB } }
    game.fieldFollowers = [peasant(P1, 10, 10, 0)]
    game.completedObjects.cities = [
      city('city-B', [{ x: 11, y: 10, direction: SideName.West }], [1]),
    ]
    game.scores = { [P1]: 0, [P2]: 0 }

    scoreFields(game)

    expect(game.scores[P1]).toBe(3)
    expect(game.scores[P2]).toBe(0)
    const fieldActions = fieldScoreActions(game)
    expect(fieldActions).toHaveLength(1)
    expect(fieldActions[0]?.actionData.isFinalScoring).toBe(true)
    expect(fieldActions[0]?.actionData.score.players).toEqual({ [P1]: 3 })
    expect(fieldActions[0]?.actionData.score.total).toBe(3)
  })

  it('при ничье оба лидера получают по 3 очка за город', () => {
    const game = setupGame({ finalScoring: true })
    const fieldTileA = fieldTile(10, 10, fields(field(['eastNorth'])), {
      [SideName.East]: TileSideType.Field,
    })
    const cityTileB = gridTile({
      x: 11,
      y: 10,
      rowIndex: 10,
      tileIndex: 11,
      id: 'B',
      sides: { ...allFieldSides, [SideName.West]: TileSideType.City },
    })
    game.tilePlacesStats = { 10: { 10: fieldTileA, 11: cityTileB } }
    game.fieldFollowers = [peasant(P1, 10, 10, 0), peasant(P2, 10, 10, 0)]
    game.completedObjects.cities = [
      city('city-B', [{ x: 11, y: 10, direction: SideName.West }], [1, 2]),
    ]
    game.scores = { [P1]: 0, [P2]: 0 }

    scoreFields(game)

    expect(game.scores[P1]).toBe(3)
    expect(game.scores[P2]).toBe(3)
    const fieldActions = fieldScoreActions(game)
    expect(fieldActions[0]?.actionData.score.players).toEqual({
      [P1]: 3,
      [P2]: 3,
    })
    expect(fieldActions[0]?.actionData.score.total).toBe(6)
  })

  it('большой подданный весит двоих и побеждает при равенстве фишек', () => {
    const game = setupGame({ finalScoring: true })
    const fieldTileA = fieldTile(10, 10, fields(field(['eastNorth'])), {
      [SideName.East]: TileSideType.Field,
    })
    const cityTileB = gridTile({
      x: 11,
      y: 10,
      rowIndex: 10,
      tileIndex: 11,
      id: 'B',
      sides: { ...allFieldSides, [SideName.West]: TileSideType.City },
    })
    game.tilePlacesStats = { 10: { 10: fieldTileA, 11: cityTileB } }
    game.fieldFollowers = [peasant(P1, 10, 10, 0, true), peasant(P2, 10, 10, 0)]
    game.completedObjects.cities = [
      city('city-B', [{ x: 11, y: 10, direction: SideName.West }], [1, 2]),
    ]
    game.scores = { [P1]: 0, [P2]: 0 }

    scoreFields(game)

    expect(game.scores[P1]).toBe(3)
    expect(game.scores[P2]).toBe(0)
  })

  it('город учитывается один раз на поле, но отдельно на каждом поле', () => {
    const game = setupGame({ finalScoring: true })
    // Поле слева и поле справа граничат с одним городом посередине.
    const fieldTileA = fieldTile(10, 10, fields(field(['eastNorth'])), {
      [SideName.East]: TileSideType.Field,
    })
    const fieldTileC = fieldTile(10, 12, fields(field(['westNorth'])), {
      [SideName.West]: TileSideType.Field,
    })
    const cityTileB = gridTile({
      x: 11,
      y: 10,
      rowIndex: 10,
      tileIndex: 11,
      id: 'B',
      sides: {
        ...allFieldSides,
        [SideName.West]: TileSideType.City,
        [SideName.East]: TileSideType.City,
      },
    })
    game.tilePlacesStats = {
      10: { 10: fieldTileA, 11: cityTileB, 12: fieldTileC },
    }
    game.fieldFollowers = [peasant(P1, 10, 10, 0), peasant(P1, 10, 12, 0)]
    game.completedObjects.cities = [
      city(
        'city-B',
        [
          { x: 11, y: 10, direction: SideName.West },
          { x: 11, y: 10, direction: SideName.East },
        ],
        [1]
      ),
    ]
    game.scores = { [P1]: 0, [P2]: 0 }

    scoreFields(game)

    // Город учитывается на каждом из двух полей: 3 + 3 = 6.
    expect(game.scores[P1]).toBe(6)
    const fieldActions = fieldScoreActions(game)
    expect(fieldActions).toHaveLength(2)
  })

  it('незавершённый город не даёт очков полю', () => {
    const game = setupGame({ finalScoring: true })
    const fieldTileA = fieldTile(10, 10, fields(field(['eastNorth'])), {
      [SideName.East]: TileSideType.Field,
    })
    const cityTileB = gridTile({
      x: 11,
      y: 10,
      rowIndex: 10,
      tileIndex: 11,
      id: 'B',
      sides: { ...allFieldSides, [SideName.West]: TileSideType.City },
    })
    game.tilePlacesStats = { 10: { 10: fieldTileA, 11: cityTileB } }
    game.fieldFollowers = [peasant(P1, 10, 10, 0)]
    // Город ещё не завершён: лежит во временных объектах.
    game.temporaryObjects.cities = [
      city('city-B', [{ x: 11, y: 10, direction: SideName.West }], [1]),
    ]
    game.scores = { [P1]: 0, [P2]: 0 }

    scoreFields(game)

    expect(game.scores[P1]).toBe(0)
    expect(fieldScoreActions(game)).toHaveLength(0)
  })

  it('поле без соприкасающихся завершённых городов не даёт очков', () => {
    const game = setupGame({ finalScoring: true })
    const tile = fieldTile(10, 10, wholeTileField())
    game.tilePlacesStats = { 10: { 10: tile } }
    game.fieldFollowers = [peasant(P1, 10, 10, 0)]
    game.scores = { [P1]: 0, [P2]: 0 }

    scoreFields(game)

    expect(game.scores[P1]).toBe(0)
    expect(fieldScoreActions(game)).toHaveLength(0)
  })
})
