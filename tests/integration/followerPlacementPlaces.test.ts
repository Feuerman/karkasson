import { describe, expect, it } from 'vitest'
import tiles from '@server/data/tiles'
import { GameManager } from '@server/modules/GameManager'
import { GameObjectManager } from '@server/modules/GameObjectManager'
import {
  PointDirection,
  SideName,
  TileId,
  TileSideType,
} from '@server/modules/types'
import type { BaseObject, GridTile, Point, Tile } from '@server/modules/types'
import {
  CENTER_X,
  CENTER_Y,
  directionsOf,
  makeEmptyGame,
  NEIGHBOR_BY_SIDE,
  rotatedCopies,
  useFirstPlayerAsCurrent,
} from '../helpers/board'

/**
 * Места под фишку считаются из групп связности и занятости объектов, поэтому
 * проверяются на живом GameManager: чистая геометрия не знает, кто какое
 * место уже занял, а сервер дополнительно сверяет присланный клиентом объект.
 */

const FEATURES = [TileSideType.Road, TileSideType.City] as const

type Feature = (typeof FEATURES)[number]

/** Коллекция временных объектов, соответствующая типу стороны */
function collectionOf(feature: Feature): 'roads' | 'cities' {
  return feature === TileSideType.Road ? 'roads' : 'cities'
}

/** Кладёт объект на каждую группу фичи; первую группу отдаёт второму игроку */
function occupyGroups(
  game: GameManager,
  tile: Tile,
  feature: Feature,
  idPrefix: string,
  occupied: boolean
): void {
  const groups = game.getTileFeatureGroups(tile, feature)
  groups.forEach((group, index) => {
    const points = group.map((direction) => ({
      x: tile.x ?? CENTER_X,
      y: tile.y ?? CENTER_Y,
      direction,
      pointType: feature,
    }))
    const objectId = `${idPrefix}-${feature}-${index}`
    const isOccupied = occupied && index === 0
    game.temporaryObjects[collectionOf(feature)].push({
      id: objectId,
      points,
      followers: isOccupied
        ? [
            {
              playerId: 2,
              objectId,
              point: points[0] ?? { x: CENTER_X, y: CENTER_Y },
            },
          ]
        : [],
    })
  })
}

/** Каталоговый тайл, положенный в центр доски */
function tileOf(id: TileId): GridTile {
  const found = tiles.find((tile) => tile.id === id)
  if (!found) throw new Error(`Tile ${id} is missing`)
  return { ...found, rotation: 0, x: CENTER_X, y: CENTER_Y }
}

/**
 * Перекрёсток с тремя дорогами и городом: поданный соседа занимает восточную
 * дорогу, а сам тайл ложится в центре. Ожидаемые направления — все группы
 * тайла, кроме занятой.
 */
describe('Доступные места при соседях вокруг тайла', () => {
  it.each([
    {
      id: TileId.L,
      sides: {
        [SideName.North]: TileSideType.City,
        [SideName.East]: TileSideType.Road,
        [SideName.South]: TileSideType.Road,
        [SideName.West]: TileSideType.Road,
      },
      expectedDirections: [SideName.North, SideName.South, SideName.West],
    },
    {
      id: TileId.W,
      sides: {
        [SideName.North]: TileSideType.Field,
        [SideName.East]: TileSideType.Road,
        [SideName.South]: TileSideType.Road,
        [SideName.West]: TileSideType.Road,
      },
      expectedDirections: [SideName.South, SideName.West],
    },
    {
      id: TileId.X,
      sides: {
        [SideName.North]: TileSideType.Road,
        [SideName.East]: TileSideType.Road,
        [SideName.South]: TileSideType.Road,
        [SideName.West]: TileSideType.Road,
      },
      expectedDirections: [SideName.North, SideName.South, SideName.West],
    },
  ])(
    'оставляет свободные ответвления перекрёстка $id доступными, если восточная дорога занята',
    ({ id, sides, expectedDirections }) => {
      const game = makeEmptyGame()
      useFirstPlayerAsCurrent(game)
      game.currentTile = { id, rotation: 0, sides, x: CENTER_X, y: CENTER_Y }

      for (const direction of [
        SideName.North,
        SideName.East,
        SideName.South,
        SideName.West,
      ] as const) {
        if (sides[direction] !== TileSideType.Road) continue

        const neighbor = NEIGHBOR_BY_SIDE[direction]
        const row = game.tilePlacesStats[neighbor.y] ?? {}
        row[neighbor.x] = {
          id: `neighbor-${direction}`,
          rotation: 0,
          x: neighbor.x,
          y: neighbor.y,
          sides: {
            [SideName.North]: TileSideType.Field,
            [SideName.East]: TileSideType.Field,
            [SideName.South]: TileSideType.Field,
            [SideName.West]: TileSideType.Field,
            [neighbor.toward]: TileSideType.Road,
          },
        }
        game.tilePlacesStats[neighbor.y] = row

        const point = {
          x: neighbor.x,
          y: neighbor.y,
          direction: neighbor.toward,
        }
        game.temporaryObjects.roads.push({
          id: `road-${direction}`,
          points: [point, { ...point, direction: neighbor.away }],
          followers:
            direction === SideName.East
              ? [{ playerId: 2, objectId: `road-${direction}`, point }]
              : [],
        })
      }

      expect(game.placeTile(game.currentTile, CENTER_Y, CENTER_X)).toBe(true)

      expect(game.isPlacingFollower).toBe(true)
      expect(directionsOf(game.availableFollowersPlaces)).toEqual(
        [...expectedDirections].sort()
      )
    }
  )

  it.each([
    {
      id: TileId.P,
      occupiedFeature: TileSideType.Road,
      expectedAvailable: [SideName.North, SideName.West],
    },
    {
      id: TileId.P,
      occupiedFeature: TileSideType.City,
      expectedAvailable: [SideName.East, SideName.South],
    },
    {
      id: TileId.H,
      occupiedFeature: TileSideType.City,
      expectedAvailable: [SideName.South],
    },
  ])(
    'сохраняет доступность независимых групп на тайле $id при занятой группе $occupiedFeature',
    ({ id, occupiedFeature, expectedAvailable }) => {
      const game = makeEmptyGame()
      const tile = tileOf(id)
      useFirstPlayerAsCurrent(game)
      game.currentTile = tile

      for (const feature of FEATURES) {
        occupyGroups(game, tile, feature, id, feature === occupiedFeature)
      }

      game.checkAvailableFollowers()

      expect(game.isPlacingFollower).toBe(true)
      expect(directionsOf(game.availableFollowersPlaces)).toEqual(
        [...expectedAvailable].sort()
      )
    }
  )

  it('предлагает все незанятые группы для всех типов каталожных тайлов и поворотов', () => {
    const rotationGame = makeEmptyGame()
    for (const definition of tiles) {
      const initialTile: Tile = { ...definition, rotation: 0 }
      for (const [turns, tile] of rotatedCopies(
        rotationGame,
        initialTile
      ).entries()) {
        const game = makeEmptyGame()
        const gridTile: GridTile = { ...tile, x: CENTER_X, y: CENTER_Y }
        useFirstPlayerAsCurrent(game)
        game.currentTile = gridTile

        const expectedDirections: string[] = []
        for (const feature of FEATURES) {
          const groups = game.getTileFeatureGroups(gridTile, feature)
          groups.forEach((group, groupIndex) => {
            const points = group.map((direction) => ({
              x: CENTER_X,
              y: CENTER_Y,
              direction,
              pointType: feature,
            }))
            const objectId = `${definition.id}-${turns}-${feature}-${groupIndex}`
            game.temporaryObjects[collectionOf(feature)].push({
              id: objectId,
              points,
              followers:
                groupIndex === 0
                  ? [
                      {
                        playerId: 2,
                        objectId,
                        point: points[0] ?? { x: CENTER_X, y: CENTER_Y },
                      },
                    ]
                  : [],
            })
            if (groupIndex > 0) expectedDirections.push(...group)
          })
        }

        if (gridTile.isMonastery || gridTile.hasGarden) {
          expectedDirections.push(PointDirection.Center)
        }
        expect(game.simulatePlaceTile(gridTile, CENTER_Y, CENTER_X)).toBe(true)

        expect(directionsOf(game.availableFollowersPlaces)).toEqual(
          [...expectedDirections].sort()
        )
      }
    }
  })
})

describe('Разделение объектов после установки тайла', () => {
  it('сохраняет отдельные городские сегменты на тайле F', () => {
    const game = makeEmptyGame()
    game.tilePlacesStats[CENTER_Y] = {
      [CENTER_X]: {
        id: TileId.F,
        rotation: 0,
        x: CENTER_X,
        y: CENTER_Y,
        sides: {
          [SideName.North]: TileSideType.Field,
          [SideName.East]: TileSideType.City,
          [SideName.South]: TileSideType.Field,
          [SideName.West]: TileSideType.City,
        },
        cityGroups: [[SideName.East], [SideName.West]],
      },
    }

    game.checkGridAfterPlacingTile(CENTER_Y, CENTER_X)

    expect(game.temporaryObjects.cities).toHaveLength(2)
  })

  it('оставляет две несвязанные области города H разными объектами', () => {
    const game = makeEmptyGame()
    game.tilePlacesStats[CENTER_Y] = {
      [CENTER_X]: {
        id: TileId.H,
        rotation: 0,
        x: CENTER_X,
        y: CENTER_Y,
        sides: {
          [SideName.North]: TileSideType.City,
          [SideName.East]: TileSideType.Field,
          [SideName.South]: TileSideType.City,
          [SideName.West]: TileSideType.Field,
        },
      },
    }

    game.checkGridAfterPlacingTile(CENTER_Y, CENTER_X)

    const [northCity, southCity] = game.temporaryObjects.cities
    expect(game.temporaryObjects.cities).toHaveLength(2)
    expect(northCity?.points.some((p) => p.direction === SideName.North)).toBe(
      true
    )
    expect(southCity?.points.some((p) => p.direction === SideName.South)).toBe(
      true
    )
  })

  it('разделяет ветви дороги тайла D', () => {
    const game = makeEmptyGame()
    game.tilePlacesStats[CENTER_Y] = {
      [CENTER_X]: {
        id: TileId.D,
        rotation: 0,
        x: CENTER_X,
        y: CENTER_Y,
        sides: {
          [SideName.North]: TileSideType.City,
          [SideName.East]: TileSideType.Road,
          [SideName.South]: TileSideType.Field,
          [SideName.West]: TileSideType.Road,
        },
        roadGroups: [[SideName.East], [SideName.West]],
        cityGroups: [[SideName.North]],
      },
    }

    game.checkGridAfterPlacingTile(CENTER_Y, CENTER_X)

    expect(game.temporaryObjects.roads).toHaveLength(2)
  })

  it('не объединяет сплошной город тайла C с несколькими городами', () => {
    const game = makeEmptyGame()
    game.tilePlacesStats[CENTER_Y] = {
      [CENTER_X]: {
        id: TileId.C,
        rotation: 0,
        x: CENTER_X,
        y: CENTER_Y,
        sides: {
          [SideName.North]: TileSideType.City,
          [SideName.East]: TileSideType.City,
          [SideName.South]: TileSideType.City,
          [SideName.West]: TileSideType.City,
        },
      },
    }

    game.checkGridAfterPlacingTile(CENTER_Y, CENTER_X)

    expect(game.temporaryObjects.cities).toHaveLength(1)
    expect(game.temporaryObjects.cities[0]?.points).toHaveLength(4)
  })
})

describe('Защита от подмены объекта клиентом', () => {
  it.each([
    { feature: TileSideType.City, direction: SideName.North },
    { feature: TileSideType.Road, direction: SideName.East },
  ])(
    'не позволяет повторно занять уже занятую связанную $feature',
    ({ feature, direction }) => {
      const game = makeEmptyGame()
      const point: Point = {
        x: CENTER_X,
        y: CENTER_Y,
        direction,
        pointType: feature,
      }
      const object: BaseObject = {
        id: `occupied-${feature}`,
        points: [point],
        followers: [{ playerId: 1, objectId: `occupied-${feature}`, point }],
      }
      game.temporaryObjects[collectionOf(feature)].push(object)
      const followersBefore = game.playersFollowers[1]?.ordinaryFollowers

      expect(
        game.simulatePlaceFollower({
          point,
          temporaryObject: { ...object, followers: [] },
        })
      ).toBe(false)
      expect(game.playersFollowers[1]?.ordinaryFollowers).toBe(followersBefore)
      expect(game.placedFollowers).toHaveLength(0)
    }
  )

  it('не позволяет изменить заявку, подменив занятый объект города', () => {
    const game = makeEmptyGame()
    game.tilePlacesStats[CENTER_Y] = {
      [CENTER_X]: {
        id: TileId.F,
        rotation: 0,
        x: CENTER_X,
        y: CENTER_Y,
        sides: {
          [SideName.North]: TileSideType.Field,
          [SideName.East]: TileSideType.City,
          [SideName.South]: TileSideType.Field,
          [SideName.West]: TileSideType.City,
        },
      },
    }
    game.checkGridAfterPlacingTile(CENTER_Y, CENTER_X)
    const city = game.temporaryObjects.cities.find((item) =>
      item.points.some((point) => point.direction === SideName.East)
    )
    expect(city).toBeDefined()
    if (!city) return

    expect(
      game.availableFollowersPlaces.find(
        (place) => place.point.direction === SideName.East
      )
    ).toBeUndefined()
    const followersBefore = game.playersFollowers[1]?.ordinaryFollowers
    expect(
      game.simulatePlaceFollower({
        point: { x: CENTER_X, y: CENTER_Y, direction: SideName.East },
        temporaryObject: { ...city, id: 'forged-city', followers: [] },
      })
    ).toBe(false)
    expect(game.playersFollowers[1]?.ordinaryFollowers).toBe(followersBefore)
  })

  it('запрещает ставить второго подданного на объединяемые группы одного тайла', () => {
    const game = makeEmptyGame()
    const firstPoint: Point = {
      x: CENTER_X,
      y: CENTER_Y,
      direction: SideName.North,
    }
    const secondPoint: Point = {
      x: CENTER_X,
      y: CENTER_Y,
      direction: SideName.East,
    }
    const city: BaseObject = {
      id: 'shared-city',
      points: [firstPoint, secondPoint],
      followers: [{ playerId: 1, objectId: 'shared-city', point: firstPoint }],
    }
    game.tilePlacesStats[CENTER_Y] = {
      [CENTER_X]: {
        id: TileId.M,
        rotation: 0,
        x: CENTER_X,
        y: CENTER_Y,
        sides: {
          [SideName.North]: TileSideType.City,
          [SideName.East]: TileSideType.City,
          [SideName.South]: TileSideType.Field,
          [SideName.West]: TileSideType.Field,
        },
        cityGroups: [[SideName.North, SideName.East]],
      },
    }
    game.temporaryObjects.cities.push(city)

    expect(
      game.simulatePlaceFollower({
        point: secondPoint,
        temporaryObject: { ...city, followers: [] },
      })
    ).toBe(false)
    expect(game.playersFollowers[1]?.ordinaryFollowers).toBe(7)
    expect(game.placedFollowers).toHaveLength(0)
  })
})

describe('Объединённые объекты принимают только одну фишку', () => {
  it('учитывает объединённый город F при размещении подданных', () => {
    const game = makeEmptyGame()
    game.tilePlacesStats[CENTER_Y] = {
      [CENTER_X]: {
        id: TileId.F,
        rotation: 0,
        x: CENTER_X,
        y: CENTER_Y,
        sides: {
          [SideName.North]: TileSideType.Field,
          [SideName.East]: TileSideType.City,
          [SideName.South]: TileSideType.Field,
          [SideName.West]: TileSideType.City,
        },
      },
    }
    game.checkGridAfterPlacingTile(CENTER_Y, CENTER_X)
    const city = game.temporaryObjects.cities.find((item) =>
      item.points.some((point) => point.direction === SideName.West)
    )
    expect(
      game.temporaryObjects.cities.find((item) =>
        item.points.some((point) => point.direction === SideName.East)
      )
    ).toBe(city)
    if (!city) return

    useFirstPlayerAsCurrent(game)
    expect(
      game.simulatePlaceFollower({
        point: { x: CENTER_X, y: CENTER_Y, direction: SideName.East },
        temporaryObject: city,
      })
    ).toBe(true)

    game.currentPlayer = game.players[1] ?? null
    game.currentPlayerIndex = 1
    expect(
      game.simulatePlaceFollower({
        point: { x: CENTER_X, y: CENTER_Y, direction: SideName.West },
        temporaryObject: city,
      })
    ).toBe(false)
  })

  it('объединяет обе стороны прямой дороги D в один объект', () => {
    const game = makeEmptyGame()
    game.tilePlacesStats[CENTER_Y] = {
      [CENTER_X]: {
        id: TileId.D,
        rotation: 0,
        x: CENTER_X,
        y: CENTER_Y,
        sides: {
          [SideName.North]: TileSideType.City,
          [SideName.East]: TileSideType.Road,
          [SideName.South]: TileSideType.Field,
          [SideName.West]: TileSideType.Road,
        },
      },
    }
    game.checkGridAfterPlacingTile(CENTER_Y, CENTER_X)
    const eastRoad = game.temporaryObjects.roads.find((road) =>
      road.points.some((point) => point.direction === SideName.East)
    )
    expect(
      game.temporaryObjects.roads.find((road) =>
        road.points.some((point) => point.direction === SideName.West)
      )
    ).toBe(eastRoad)
    if (!eastRoad) return

    useFirstPlayerAsCurrent(game)
    const eastPlace = {
      point: { x: CENTER_X, y: CENTER_Y, direction: SideName.East },
      temporaryObject: eastRoad,
    }
    expect(game.simulatePlaceFollower(eastPlace)).toBe(true)

    game.currentPlayer = game.players[1] ?? null
    game.currentPlayerIndex = 1
    expect(
      game.simulatePlaceFollower({
        point: { x: CENTER_X, y: CENTER_Y, direction: SideName.West },
        temporaryObject: eastRoad,
      })
    ).toBe(false)
  })
})

describe('Снятие фишки при завершении объекта', () => {
  it.each([
    {
      feature: TileSideType.City,
      followerPoint: { x: 14, y: 15, direction: SideName.North },
      secondPoint: { x: 14, y: 14, direction: SideName.South },
    },
    {
      feature: TileSideType.Road,
      followerPoint: { x: 14, y: 15, direction: SideName.East },
      secondPoint: { x: 15, y: 15, direction: SideName.West },
    },
  ])(
    'убирает маркер при завершении $feature, даже если ID объекта изменился',
    ({ feature, followerPoint, secondPoint }) => {
      const game = makeEmptyGame()
      const object: BaseObject = {
        id: `completed-${feature}`,
        points: [followerPoint, secondPoint],
        followers: [
          {
            playerId: 1,
            objectId: 'old-merged-id',
            point: followerPoint,
          },
        ],
      }
      game.playersFollowers[1].ordinaryFollowers = 6
      game.temporaryObjects[collectionOf(feature)].push(object)
      game.placedFollowers.push({
        playerId: 1,
        objectId: 'old-merged-id',
        point: followerPoint,
      })

      new GameObjectManager(game).checkCompleteLinearFeature(feature, object)

      expect(game.placedFollowers).toHaveLength(0)
      expect(game.playersFollowers[1]?.ordinaryFollowers).toBe(7)
    }
  )
})
