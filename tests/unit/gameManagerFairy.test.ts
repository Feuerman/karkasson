import { describe, expect, it } from 'vitest'
import { wholeTileField } from '@server/data/fieldTopology'
import { GameObjectManager } from '@server/modules/GameObjectManager'
import { GameManager } from '@server/modules/GameManager'
import {
  deserializeGameState,
  serializeGameState,
} from '@server/modules/gameSave'
import {
  ActionTypes,
  FollowerType,
  SideName,
  TileSideType,
  type BaseObject,
  type GridTile,
  type Point,
} from '@server/modules/types'
import { makePlayers } from '../helpers/fixtures'

const allFieldSides = {
  [SideName.North]: TileSideType.Field,
  [SideName.East]: TileSideType.Field,
  [SideName.South]: TileSideType.Field,
  [SideName.West]: TileSideType.Field,
}

function fieldTile(
  rowIndex: number,
  tileIndex: number,
  hasMagicPortal = false
): GridTile {
  return {
    id: 'field',
    rotation: 0,
    x: tileIndex,
    y: rowIndex,
    rowIndex,
    tileIndex,
    sides: allFieldSides,
    fieldTopology: wholeTileField(),
    hasMagicPortal,
  } as unknown as GridTile
}

function cityPoint(direction = SideName.North): Point {
  return { x: 10, y: 10, direction, pointType: TileSideType.City }
}

function objectFollower(playerId: number, point: Point) {
  return { playerId, objectId: 'city', point }
}

describe('Фея', () => {
  it('перемещается к своему подданному вместо выставления фишки', () => {
    const players = makePlayers()
    const game = new GameManager({
      players,
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    const point = cityPoint()
    const object: BaseObject = {
      id: 'city',
      points: [point],
      followers: [objectFollower(1, point)],
    }
    game.temporaryObjects.cities.push(object)
    game.placedFollowers.push(objectFollower(1, point))
    game.currentPlayer = players[0] ?? null
    game.currentPlayerIndex = 0
    game.isPlacingFollower = true
    game.currentTile = null

    const target = game.getFairyTargets()[0]
    expect(target).toBeDefined()
    if (!target) return

    expect(game.moveFairyToFollower(target.point)).toBe(true)
    expect(game.fairy?.follower?.playerId).toBe(1)
    expect(game.fairy?.position).toEqual({ rowIndex: 10, tileIndex: 10 })
    expect(
      game.actionsHistory.some(
        ({ actionType }) => actionType === ActionTypes.MOVE_FAIRY
      )
    ).toBe(true)
    expect(game.isPlacingFollower).toBe(false)
  })

  it('начисляет очко в начале хода владельца связанного подданного', () => {
    const players = makePlayers()
    const game = new GameManager({
      players,
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    const point = cityPoint()
    game.temporaryObjects.cities.push({
      id: 'city',
      points: [point],
      followers: [objectFollower(1, point)],
    })
    game.placedFollowers.push(objectFollower(1, point))
    game.fairy = {
      position: { rowIndex: 10, tileIndex: 10 },
      follower: objectFollower(1, point),
    }
    game.currentPlayer = players[0] ?? null
    game.currentPlayerIndex = 0

    expect(game.awardFairyPoint()).toBe(true)
    expect(game.scores[1]).toBe(1)
    expect(
      game.actionsHistory.some(
        ({ actionType }) => actionType === ActionTypes.FAIRY_POINT
      )
    ).toBe(true)

    game.currentPlayer = players[1] ?? null
    game.currentPlayerIndex = 1
    expect(game.awardFairyPoint()).toBe(false)
    expect(game.scores[1]).toBe(1)
  })

  it('не предлагает переместить фею к уже связанному подданному', () => {
    const game = new GameManager({
      players: makePlayers(),
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    const point = cityPoint()
    const follower = objectFollower(1, point)
    game.temporaryObjects.cities.push({
      id: 'city',
      points: [point],
      followers: [follower],
    })
    game.placedFollowers.push(follower)
    game.fairy = {
      position: { rowIndex: 10, tileIndex: 10 },
      follower,
    }
    game.currentPlayer = game.players[0] ?? null
    game.currentPlayerIndex = 0
    game.isPlacingFollower = true

    expect(game.getFairyTargets()).toHaveLength(0)
    expect(game.canMoveFairy()).toBe(false)
  })

  it('возвращает фишку после подсчёта и снимает связь с феей', () => {
    const game = new GameManager({
      players: makePlayers(),
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    game.currentPlayer = game.players[0] ?? null
    game.currentPlayerIndex = 0
    const point = cityPoint()
    const follower = objectFollower(1, point)
    game.temporaryObjects.cities.push({
      id: 'city',
      points: [point],
      followers: [follower],
    })
    game.placedFollowers.push(follower)
    game.fairy = {
      position: { rowIndex: 10, tileIndex: 10 },
      follower,
    }

    expect(game.getFairyTargets()).toHaveLength(0)
    expect(game.getFairyTargets(1, true)).toHaveLength(1)
    new GameObjectManager(game).checkCompleteLinearFeature(TileSideType.City, {
      id: 'city',
      points: [
        point,
        {
          x: 10,
          y: 9,
          direction: SideName.South,
          pointType: TileSideType.City,
        },
      ],
      followers: [follower],
    })

    expect(game.fairy?.position).toEqual({ rowIndex: 10, tileIndex: 10 })
    expect(game.fairy?.follower).toBeUndefined()
    expect(game.getFairyTargets()).toHaveLength(0)
  })

  it('добавляет три очка владельцу связанного подданного при подсчёте', () => {
    const players = makePlayers()
    const game = new GameManager({ players, startImmediately: false })
    const north: Point = {
      ...cityPoint(),
      pointType: TileSideType.Road,
    }
    const south: Point = {
      x: 10,
      y: 9,
      direction: SideName.South,
      pointType: TileSideType.Road,
    }
    const road: BaseObject = {
      id: 'road',
      points: [north, south],
      followers: [objectFollower(1, north)],
    }
    game.temporaryObjects.roads.push(road)
    game.placedFollowers.push(objectFollower(1, north))
    game.tilePlacesStats = {
      9: { 10: fieldTile(9, 10) },
      10: { 10: fieldTile(10, 10) },
    }
    game.fairy = {
      position: { rowIndex: 10, tileIndex: 10 },
      follower: objectFollower(1, north),
    }

    new GameObjectManager(game).checkCompleteLinearFeature(
      TileSideType.Road,
      road
    )

    expect(game.scores[1]).toBe(5)
    const scoreAction = game.actionsHistory.find(
      ({ actionType }) => actionType === ActionTypes.ADDING_SCORES
    )
    expect(scoreAction?.actionType).toBe(ActionTypes.ADDING_SCORES)
    if (!scoreAction || scoreAction.actionType !== ActionTypes.ADDING_SCORES)
      return
    expect(scoreAction.actionData.score.total).toBe(5)
    expect(scoreAction.actionData.details).toContainEqual({
      label: 'Бонус феи',
      count: 1,
      pointsPerUnit: 3,
      total: 3,
    })
    expect(game.fairy?.follower).toBeUndefined()
  })

  it('сохраняет положение феи и привязку', () => {
    const game = new GameManager({
      players: makePlayers(),
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    const point = cityPoint()
    game.id = 'fairy-save'
    game.fairy = {
      position: { rowIndex: 10, tileIndex: 10 },
      follower: objectFollower(1, point),
    }
    game.isPlacingFairy = true

    const restored = deserializeGameState(serializeGameState(game))

    expect(restored.isPlacingFairy).toBe(true)
    expect(restored.fairy?.position).toEqual({ rowIndex: 10, tileIndex: 10 })
    expect(restored.fairy?.follower?.playerId).toBe(1)
    expect(restored.fairy?.follower?.point).toEqual(point)
  })

  it('не пускает дракона на клетку феи', () => {
    const players = makePlayers()
    const game = new GameManager({
      players,
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    game.currentPlayer = players[0] ?? null
    game.currentPlayerIndex = 0
    game.dragonPosition = { rowIndex: 0, tileIndex: 0 }
    game.dragonMove = {
      remainingSteps: 1,
      nextPlayerIndex: 0,
      resumePlayerIndex: 0,
      visited: [{ rowIndex: 0, tileIndex: 0 }],
    }
    game.fairy = { position: { rowIndex: 0, tileIndex: 1 } }
    game.tilePlacesStats = {
      0: { 0: fieldTile(0, 0), 1: fieldTile(0, 1) },
      1: { 0: fieldTile(1, 0) },
    }

    expect(game.moveDragon(0, 1)).toBe(false)
    expect(game.moveDragon(1, 0)).toBe(true)
  })
})

describe('Магический портал', () => {
  it('разрешает выставить подданного на незавершённый объект по всей доске', () => {
    const players = makePlayers()
    const game = new GameManager({
      players,
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    game.currentPlayer = players[0] ?? null
    game.currentPlayerIndex = 0
    const portal = fieldTile(0, 0, true)
    const cityTile = {
      ...fieldTile(5, 5),
      sides: {
        ...allFieldSides,
        [SideName.North]: TileSideType.City,
      },
    }
    const point: Point = {
      x: 5,
      y: 5,
      direction: SideName.North,
      pointType: TileSideType.City,
    }
    const city: BaseObject = { id: 'city', points: [point], followers: [] }
    game.tilePlacesStats = { 0: { 0: portal }, 5: { 5: cityTile } }
    game.temporaryObjects.cities.push(city)
    game.currentTile = portal
    game.lastPlacement = { rowIndex: 0, tileIndex: 0 }

    game.checkAvailableFollowers()

    const cityPlace = game.availableFollowersPlaces.find(
      ({ point: placePoint }) =>
        placePoint.x === 5 &&
        placePoint.y === 5 &&
        placePoint.direction === SideName.North
    )
    expect(cityPlace).toBeDefined()
    if (!cityPlace) return

    game.placeFollower(cityPlace, FollowerType.Follower)

    expect(city.followers).toHaveLength(1)
    expect(city.followers[0]?.playerId).toBe(1)
  })

  it('отклоняет присланное место на старом объекте без портала', () => {
    const players = makePlayers()
    const game = new GameManager({
      players,
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    game.currentPlayer = players[0] ?? null
    game.currentPlayerIndex = 0
    const currentTile = fieldTile(0, 0)
    const cityTile = {
      ...fieldTile(5, 5),
      sides: {
        ...allFieldSides,
        [SideName.North]: TileSideType.City,
      },
    }
    const point: Point = {
      x: 5,
      y: 5,
      direction: SideName.North,
      pointType: TileSideType.City,
    }
    const city: BaseObject = { id: 'city', points: [point], followers: [] }
    game.tilePlacesStats = { 0: { 0: currentTile }, 5: { 5: cityTile } }
    game.temporaryObjects.cities.push(city)
    game.currentTile = currentTile
    game.lastPlacement = { rowIndex: 0, tileIndex: 0 }

    game.placeFollower(
      {
        point,
        temporaryObject: city,
      },
      FollowerType.Follower
    )

    expect(city.followers).toHaveLength(0)
    expect(game.playersFollowers[1]?.ordinaryFollowers).toBe(7)
  })

  it('разрешает крестьянина на удалённое поле', () => {
    const players = makePlayers()
    const game = new GameManager({
      players,
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    game.currentPlayer = players[0] ?? null
    game.currentPlayerIndex = 0
    const portal = fieldTile(0, 0, true)
    const far = fieldTile(5, 5)
    game.tilePlacesStats = { 0: { 0: portal }, 5: { 5: far } }
    game.currentTile = portal
    game.lastPlacement = { rowIndex: 0, tileIndex: 0 }

    game.checkAvailableFollowers()

    const farPlace = game.availableFollowersPlaces.find(
      ({ point }) => point.rowIndex === 5 && point.tileIndex === 5
    )
    expect(farPlace).toBeDefined()
    if (!farPlace) return

    game.placeFollower(farPlace, FollowerType.Follower)

    expect(game.fieldFollowers).toHaveLength(1)
    expect(game.fieldFollowers[0]?.point.tileIndex).toBe(5)
  })

  it('не разрешает удалённое поле без портала', () => {
    const players = makePlayers()
    const game = new GameManager({
      players,
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    game.currentPlayer = players[0] ?? null
    game.currentPlayerIndex = 0
    const portal = fieldTile(0, 0, true)
    const far = fieldTile(5, 5)
    game.tilePlacesStats = { 0: { 0: portal }, 5: { 5: far } }
    game.lastPlacement = { rowIndex: 0, tileIndex: 0 }

    game.currentTile = portal
    game.lastPlacement = { rowIndex: 0, tileIndex: 0 }
    game.checkAvailableFollowers()
    const farPlace = game.availableFollowersPlaces.find(
      ({ point }) => point.rowIndex === 5 && point.tileIndex === 5
    )
    expect(farPlace).toBeDefined()
    if (!farPlace) return

    game.tilePlacesStats[0] = {
      0: fieldTile(0, 0),
    }

    game.placeFollower(farPlace, FollowerType.Follower)
    expect(game.fieldFollowers).toHaveLength(0)
  })

  it('исключает клетку дракона', () => {
    const players = makePlayers()
    const game = new GameManager({
      players,
      startImmediately: false,
      princessAndDragonEnabled: true,
    })
    game.currentPlayer = players[0] ?? null
    game.currentPlayerIndex = 0
    const portal = fieldTile(0, 0, true)
    game.tilePlacesStats = {
      0: { 0: portal },
      5: { 5: fieldTile(5, 5) },
    }
    game.dragonPosition = { rowIndex: 5, tileIndex: 5 }
    game.currentTile = portal
    game.lastPlacement = { rowIndex: 0, tileIndex: 0 }

    game.checkAvailableFollowers()

    expect(
      game.availableFollowersPlaces.some(
        ({ point }) => point.rowIndex === 5 && point.tileIndex === 5
      )
    ).toBe(false)
  })
})
