import { describe, expect, it } from 'vitest'
import tiles from '@server/data/tiles'
import { innsAndCathedralsTiles } from '@server/data/innsAndCathedralsTiles'
import { GameManager } from '@server/modules/GameManager'
import {
  PointDirection,
  SideName,
  TileId,
  TileSideType,
} from '@server/modules/types'
import type { BaseObject, Point, Player, Tile } from '@server/modules/types'

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

describe('Размещение тайла не зависит от порядка ключей sides', () => {
  it('принимает повёрнутый тайл со сторонами в клиентском порядке {north,west,south,east}', () => {
    const game = new GameManager({ players: makePlayers() })

    // Стартовый E на (15,15): north=city, east=road, south=field, west=road.
    // Тайл восточнее E (15,16): запад должен быть дорогой (E.east = road),
    // восток задан городом, чтобы проверить, что east/west не перепутаны.
    // Порядок ключей — как у клиентского rotateSides: north, west, south, east.
    const rotatedTile: Tile = {
      id: TileId.J,
      rotation: 90,
      sides: {
        [SideName.North]: TileSideType.Field,
        [SideName.West]: TileSideType.Road,
        [SideName.South]: TileSideType.Field,
        [SideName.East]: TileSideType.City,
      },
    }

    expect(game.isCorrectTilePosition(rotatedTile, 15, 16)).toBe(true)
  })

  it('по-прежнему отклоняет тайл с несовпадающей стороной', () => {
    const game = new GameManager({ players: makePlayers() })

    const tile: Tile = {
      id: TileId.X,
      rotation: 0,
      sides: {
        [SideName.North]: TileSideType.Field,
        [SideName.West]: TileSideType.City,
        [SideName.South]: TileSideType.Field,
        [SideName.East]: TileSideType.City,
      },
    }

    // Запад должен быть road (E.east), а тут city — размещение невалидно.
    expect(game.isCorrectTilePosition(tile, 15, 16)).toBe(false)
  })
})

describe('Проверка размещения и возврата подданных', () => {
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
  ] as const)(
    'оставляет свободные ответвления перекрёстка $id доступными, если восточная дорога занята',
    ({ id, sides, expectedDirections }) => {
      const game = new GameManager({
        players: makePlayers(),
        startImmediately: false,
      })
      const x = 15
      const y = 15
      game.currentPlayer = game.players[0] ?? null
      game.currentPlayerIndex = 0
      game.currentTile = { id, rotation: 0, sides, x, y }

      const neighbors = {
        [SideName.North]: {
          x,
          y: y - 1,
          toward: SideName.South,
          away: SideName.North,
        },
        [SideName.East]: {
          x: x + 1,
          y,
          toward: SideName.West,
          away: SideName.East,
        },
        [SideName.South]: {
          x,
          y: y + 1,
          toward: SideName.North,
          away: SideName.South,
        },
        [SideName.West]: {
          x: x - 1,
          y,
          toward: SideName.East,
          away: SideName.West,
        },
      } as const

      for (const direction of [
        SideName.North,
        SideName.East,
        SideName.South,
        SideName.West,
      ] as const) {
        if (sides[direction] !== TileSideType.Road) continue

        const neighbor = neighbors[direction]
        const neighborSides = {
          [SideName.North]: TileSideType.Field,
          [SideName.East]: TileSideType.Field,
          [SideName.South]: TileSideType.Field,
          [SideName.West]: TileSideType.Field,
          [neighbor.toward]: TileSideType.Road,
        }
        const row = game.tilePlacesStats[neighbor.y] ?? {}
        row[neighbor.x] = {
          id: `neighbor-${direction}`,
          rotation: 0,
          x: neighbor.x,
          y: neighbor.y,
          sides: neighborSides,
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
              ? [
                  {
                    playerId: 2,
                    objectId: `road-${direction}`,
                    point,
                  },
                ]
              : [],
        })
      }

      expect(game.placeTile(game.currentTile, y, x)).toBe(true)

      expect(game.isPlacingFollower).toBe(true)
      expect(
        game.availableFollowersPlaces.map((place) => place.point.direction)
      ).toEqual(expectedDirections)
    }
  )

  it('нормализует стороны каждого каталожного тайла в группы без пропусков и дублей', () => {
    const game = new GameManager({
      players: makePlayers(),
      startImmediately: false,
    })

    for (const definition of tiles) {
      for (const feature of [TileSideType.Road, TileSideType.City] as const) {
        for (let turns = 0; turns < 4; turns += 1) {
          let rotatedTile: Tile = { ...definition, rotation: 0 }
          for (let turn = 0; turn < turns; turn += 1) {
            rotatedTile = game.rotateTile(rotatedTile)
          }
          const featureSides = (
            Object.keys(rotatedTile.sides) as (keyof typeof rotatedTile.sides)[]
          ).filter((side) => rotatedTile.sides[side] === feature)
          const groups = game.getTileFeatureGroups(rotatedTile, feature)
          const groupedSides = groups.flat()

          expect(groupedSides.sort()).toEqual([...featureSides].sort())
          expect(new Set(groupedSides).size).toBe(groupedSides.length)

          if (feature === TileSideType.Road && featureSides.length >= 3) {
            expect(groups.every((group) => group.length === 1)).toBe(true)
          }
        }
      }
    }
  })

  it('проверяет стороны и группы связности каждого тайла дополнения', () => {
    const game = new GameManager({
      players: makePlayers(),
      startImmediately: false,
      innsAndCathedralsEnabled: true,
    })

    for (const definition of innsAndCathedralsTiles) {
      for (const feature of [TileSideType.Road, TileSideType.City] as const) {
        for (let turns = 0; turns < 4; turns += 1) {
          let rotatedTile: Tile = { ...definition, rotation: 0 }
          for (let turn = 0; turn < turns; turn += 1) {
            rotatedTile = game.rotateTile(rotatedTile)
          }
          const featureSides = (
            Object.keys(rotatedTile.sides) as (keyof typeof rotatedTile.sides)[]
          ).filter((side) => rotatedTile.sides[side] === feature)
          const groups = game.getTileFeatureGroups(rotatedTile, feature)
          const groupedSides = groups.flat()

          expect(
            groupedSides.sort(),
            `${definition.id} ${feature} at ${turns * 90} degrees`
          ).toEqual([...featureSides].sort())
          expect(new Set(groupedSides).size).toBe(groupedSides.length)
        }
      }
    }
  })

  it('проверяет ожидаемую топологию дорог и городов всех тайлов дополнения', () => {
    const game = new GameManager({
      players: makePlayers(),
      startImmediately: false,
      innsAndCathedralsEnabled: true,
    })
    const expectedGroups: Partial<
      Record<TileId, { road: string[][]; city: string[][] }>
    > = {
      [TileId.IAC_A]: { road: [[SideName.South, SideName.West]], city: [] },
      [TileId.IAC_B]: { road: [[SideName.East, SideName.West]], city: [] },
      [TileId.IAC_C]: {
        road: [[SideName.East], [SideName.South], [SideName.West]],
        city: [],
      },
      [TileId.IAC_D]: { road: [[SideName.East], [SideName.West]], city: [] },
      [TileId.IAC_E]: {
        road: [
          [SideName.North, SideName.West],
          [SideName.East, SideName.South],
        ],
        city: [],
      },
      [TileId.IAC_F]: {
        road: [[SideName.East]],
        city: [[SideName.North, SideName.West]],
      },
      [TileId.IAC_G]: { road: [], city: [[SideName.West]] },
      [TileId.IAC_H]: {
        road: [],
        city: [
          [SideName.North],
          [SideName.East],
          [SideName.South],
          [SideName.West],
        ],
      },
      [TileId.IAC_I]: {
        road: [[SideName.East], [SideName.West]],
        city: [[SideName.North], [SideName.South]],
      },
      [TileId.IAC_J]: { road: [[SideName.South]], city: [[SideName.North]] },
      [TileId.IAC_Ka]: {
        road: [],
        city: [[SideName.North, SideName.East, SideName.South, SideName.West]],
      },
      [TileId.IAC_Kb]: {
        road: [],
        city: [[SideName.North, SideName.East, SideName.South, SideName.West]],
      },
      [TileId.IAC_L]: {
        road: [[SideName.East, SideName.South]],
        city: [[SideName.North, SideName.West]],
      },
      [TileId.IAC_M]: {
        road: [[SideName.South, SideName.West]],
        city: [[SideName.North]],
      },
      [TileId.IAC_N]: {
        road: [[SideName.South]],
        city: [[SideName.North, SideName.West]],
      },
      [TileId.IAC_O]: {
        road: [],
        city: [[SideName.North], [SideName.East], [SideName.West]],
      },
      [TileId.IAC_P]: {
        road: [],
        city: [[SideName.North, SideName.West], [SideName.South]],
      },
      [TileId.IAC_Q]: {
        road: [[SideName.North], [SideName.South]],
        city: [[SideName.East, SideName.West]],
      },
    }

    expect(Object.keys(expectedGroups).sort()).toEqual(
      innsAndCathedralsTiles.map(({ id }) => id).sort()
    )
    for (const definition of innsAndCathedralsTiles) {
      for (const feature of [TileSideType.Road, TileSideType.City] as const) {
        expect(
          game.getTileFeatureGroups({ ...definition, rotation: 0 }, feature),
          `${definition.id} ${feature}`
        ).toEqual(expectedGroups[definition.id]?.[feature])
      }

      const roadSides = Object.entries(definition.sides)
        .filter(([, sideType]) => sideType === TileSideType.Road)
        .map(([side]) => side)
      const citySides = Object.entries(definition.sides)
        .filter(([, sideType]) => sideType === TileSideType.City)
        .map(([side]) => side)
      for (const [feature, groups, validSides] of [
        [TileSideType.Road, definition.roadGroups, roadSides],
        [TileSideType.City, definition.cityGroups, citySides],
        ['shield', definition.cityShieldGroups, citySides],
      ] as const) {
        for (const group of groups ?? []) {
          expect(
            group.every((side) => validSides.includes(side)),
            `${definition.id} ${feature} group ${group.join(',')}`
          ).toBe(true)
        }
      }
    }
  })

  it('сохраняет заданные группы дорог на тайлах дополнения', () => {
    const game = new GameManager({
      players: makePlayers(),
      startImmediately: false,
      innsAndCathedralsEnabled: true,
    })
    const getExpansionTile = (id: string) => {
      const definition = innsAndCathedralsTiles.find((tile) => tile.id === id)
      if (!definition) throw new Error(`Tile ${id} is missing`)
      return { ...definition, rotation: 0 }
    }

    expect(
      game.getTileFeatureGroups(
        getExpansionTile(TileId.IAC_E),
        TileSideType.Road
      )
    ).toEqual([
      [SideName.North, SideName.West],
      [SideName.East, SideName.South],
    ])
    expect(
      game.getTileFeatureGroups(
        getExpansionTile(TileId.IAC_I),
        TileSideType.Road
      )
    ).toEqual([[SideName.East], [SideName.West]])
    expect(
      game.getTileFeatureGroups(
        game.rotateTile(getExpansionTile(TileId.IAC_E)),
        TileSideType.Road
      )
    ).toEqual([
      [SideName.East, SideName.North],
      [SideName.South, SideName.West],
    ])
  })

  it('описывает два отдельных города IAC-P и относит герб к одному из них', () => {
    const tile = innsAndCathedralsTiles.find(({ id }) => id === TileId.IAC_P)
    if (!tile) throw new Error('Tile IAC-P is missing')
    const game = new GameManager({
      players: makePlayers(),
      startImmediately: false,
      innsAndCathedralsEnabled: true,
    })

    expect(
      game.getTileFeatureGroups({ ...tile, rotation: 0 }, TileSideType.City)
    ).toEqual([[SideName.North, SideName.West], [SideName.South]])
    expect(tile.cityShieldGroups).toEqual([[SideName.North, SideName.West]])
  })

  it('предлагает все незанятые группы для всех типов каталожных тайлов и поворотов', () => {
    for (const definition of tiles) {
      for (let turns = 0; turns < 4; turns += 1) {
        const game = new GameManager({
          players: makePlayers(),
          startImmediately: false,
        })
        let tile: Tile = { ...definition, rotation: 0 }
        for (let turn = 0; turn < turns; turn += 1) {
          tile = game.rotateTile(tile)
        }
        const x = 15
        const y = 15
        const gridTile = { ...tile, x, y }
        game.currentPlayer = game.players[0] ?? null
        game.currentPlayerIndex = 0
        game.currentTile = gridTile

        const expectedDirections: string[] = []
        for (const feature of [TileSideType.Road, TileSideType.City] as const) {
          const collection = feature === TileSideType.Road ? 'roads' : 'cities'
          const groups = game.getTileFeatureGroups(gridTile, feature)
          groups.forEach((group, groupIndex) => {
            const points = group.map((direction) => ({
              x,
              y,
              direction,
              pointType: feature,
            }))
            const objectId = `${definition.id}-${turns}-${feature}-${groupIndex}`
            game.temporaryObjects[collection].push({
              id: objectId,
              points,
              followers:
                groupIndex === 0
                  ? [
                      {
                        playerId: 2,
                        objectId,
                        point: points[0] ?? { x, y },
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
        expect(game.simulatePlaceTile(gridTile, y, x)).toBe(true)

        expect(
          game.availableFollowersPlaces
            .map((place) => place.point.direction)
            .sort()
        ).toEqual(expectedDirections.sort())
      }
    }
  })

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
  ] as const)(
    'сохраняет доступность независимых групп на смешанном/городском тайле $id при занятой группе $occupiedFeature',
    ({ id, occupiedFeature, expectedAvailable }) => {
      const game = new GameManager({
        players: makePlayers(),
        startImmediately: false,
      })
      const definition = tiles.find((tile) => tile.id === id)
      if (!definition) throw new Error(`Tile ${id} is missing`)
      const tile = { ...definition, rotation: 0, x: 15, y: 15 }
      game.currentPlayer = game.players[0] ?? null
      game.currentPlayerIndex = 0
      game.currentTile = tile

      for (const feature of [TileSideType.Road, TileSideType.City] as const) {
        const collection = feature === TileSideType.Road ? 'roads' : 'cities'
        const groups = game.getTileFeatureGroups(tile, feature)
        groups.forEach((group, index) => {
          const points = group.map((direction) => ({
            x: tile.x,
            y: tile.y,
            direction,
            pointType: feature,
          }))
          const isOccupied = feature === occupiedFeature && index === 0
          const object: BaseObject = {
            id: `${id}-${feature}-${index}`,
            points,
            followers: isOccupied
              ? [
                  {
                    playerId: 2,
                    objectId: `${id}-${feature}-${index}`,
                    point: points[0] ?? { x: tile.x, y: tile.y },
                  },
                ]
              : [],
          }
          game.temporaryObjects[collection].push(object)
        })
      }

      game.checkAvailableFollowers()

      expect(game.isPlacingFollower).toBe(true)
      expect(
        game.availableFollowersPlaces
          .map((place) => place.point.direction)
          .sort()
      ).toEqual([...expectedAvailable].sort())
    }
  )

  it('сохраняет отдельные городские сегменты на тайле F', () => {
    const game = new GameManager({ players: makePlayers() })
    game.temporaryObjects.cities = []
    game.temporaryObjects.roads = []
    game.temporaryObjects.monasteries = []
    game.temporaryObjects.gardens = []
    const tile = {
      id: TileId.F,
      rotation: 0,
      sides: {
        [SideName.North]: TileSideType.Field,
        [SideName.East]: TileSideType.City,
        [SideName.South]: TileSideType.Field,
        [SideName.West]: TileSideType.City,
      },
      cityGroups: [[SideName.East], [SideName.West]],
      x: 15,
      y: 15,
    }
    game.tilePlacesStats[15] = {
      15: {
        ...tile,
      },
    }

    game.checkGridAfterPlacingTile(15, 15)

    expect(game.temporaryObjects.cities).toHaveLength(2)
  })

  it.each([TileSideType.City, TileSideType.Road] as const)(
    'не позволяет повторно занять уже занятую связанную %s',
    (feature) => {
      const game = new GameManager({ players: makePlayers() })
      game.temporaryObjects.cities = []
      game.temporaryObjects.roads = []
      const point: Point = {
        x: 15,
        y: 15,
        direction:
          feature === TileSideType.City ? SideName.North : SideName.East,
        pointType: feature,
      }
      const object: BaseObject = {
        id: `occupied-${feature}`,
        points: [point],
        followers: [
          {
            playerId: 1,
            objectId: `occupied-${feature}`,
            point,
          },
        ],
      }
      game.temporaryObjects[
        feature === TileSideType.City ? 'cities' : 'roads'
      ].push(object)
      const forgedPlace = {
        point,
        temporaryObject: { ...object, followers: [] },
      }
      const followersBefore = game.playersFollowers[1]?.ordinaryFollowers

      expect(game.simulatePlaceFollower(forgedPlace)).toBe(false)
      expect(game.playersFollowers[1]?.ordinaryFollowers).toBe(followersBefore)
      expect(game.placedFollowers).toHaveLength(0)
    }
  )

  it('запрещает ставить второго подданного на объединяемые группы одного тайла', () => {
    const game = new GameManager({ players: makePlayers() })
    game.temporaryObjects.cities = []
    game.temporaryObjects.roads = []
    game.temporaryObjects.monasteries = []
    game.temporaryObjects.gardens = []
    const firstPoint: Point = { x: 15, y: 15, direction: SideName.North }
    const secondPoint: Point = { x: 15, y: 15, direction: SideName.East }
    const city: BaseObject = {
      id: 'shared-city',
      points: [firstPoint, secondPoint],
      followers: [{ playerId: 1, objectId: 'shared-city', point: firstPoint }],
    }
    game.tilePlacesStats[15] = {
      15: {
        id: TileId.M,
        rotation: 0,
        x: 15,
        y: 15,
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
    const place = {
      point: secondPoint,
      temporaryObject: { ...city, followers: [] },
    }

    expect(game.simulatePlaceFollower(place)).toBe(false)
    expect(game.playersFollowers[1]?.ordinaryFollowers).toBe(7)
    expect(game.placedFollowers).toHaveLength(0)
  })

  it('оставляет две несвязанные области города H разными объектами', () => {
    const game = new GameManager({ players: makePlayers() })
    game.temporaryObjects.cities = []
    game.temporaryObjects.roads = []
    game.temporaryObjects.monasteries = []
    game.temporaryObjects.gardens = []
    game.tilePlacesStats[15] = {
      15: {
        id: TileId.H,
        rotation: 0,
        x: 15,
        y: 15,
        sides: {
          [SideName.North]: TileSideType.City,
          [SideName.East]: TileSideType.Field,
          [SideName.South]: TileSideType.City,
          [SideName.West]: TileSideType.Field,
        },
      },
    }

    game.checkGridAfterPlacingTile(15, 15)

    expect(game.temporaryObjects.cities).toHaveLength(2)
    const northCity = game.temporaryObjects.cities.find((city) =>
      city.points.some((point) => point.direction === SideName.North)
    )
    const southCity = game.temporaryObjects.cities.find((city) =>
      city.points.some((point) => point.direction === SideName.South)
    )
    expect(northCity).toBeDefined()
    expect(southCity).toBeDefined()
    expect(northCity).not.toBe(southCity)
  })

  it('разделяет ветви дороги тайла D', () => {
    const game = new GameManager({ players: makePlayers() })
    game.temporaryObjects.cities = []
    game.temporaryObjects.roads = []
    game.temporaryObjects.monasteries = []
    game.temporaryObjects.gardens = []
    game.tilePlacesStats[15] = {
      15: {
        id: TileId.D,
        rotation: 0,
        x: 15,
        y: 15,
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

    game.checkGridAfterPlacingTile(15, 15)

    expect(game.temporaryObjects.roads).toHaveLength(2)
  })

  it('учитывает объединённый город F при размещении подданных', () => {
    const game = new GameManager({ players: makePlayers() })
    game.temporaryObjects.cities = []
    game.temporaryObjects.roads = []
    game.temporaryObjects.monasteries = []
    game.temporaryObjects.gardens = []
    const tile: Tile = {
      id: TileId.F,
      rotation: 0,
      sides: {
        [SideName.North]: TileSideType.Field,
        [SideName.East]: TileSideType.City,
        [SideName.South]: TileSideType.Field,
        [SideName.West]: TileSideType.City,
      },
    }
    game.tilePlacesStats[15] = {
      15: { ...tile, x: 15, y: 15 },
    }
    game.checkGridAfterPlacingTile(15, 15)
    const westCity = game.temporaryObjects.cities.find((city) =>
      city.points.some((point) => point.direction === SideName.West)
    )
    const eastCity = game.temporaryObjects.cities.find((city) =>
      city.points.some((point) => point.direction === SideName.East)
    )
    expect(westCity).toBeDefined()
    expect(eastCity).toBe(westCity)
    if (!westCity || !eastCity) return

    const eastPlace = {
      point: { x: 15, y: 15, direction: SideName.East },
      temporaryObject: eastCity,
    }
    game.currentPlayer = game.players[1] ?? null
    game.currentPlayerIndex = 1
    expect(game.simulatePlaceFollower(eastPlace)).toBe(true)
    const westPlace = {
      point: { x: 15, y: 15, direction: SideName.West },
      temporaryObject: westCity,
    }
    game.currentPlayer = game.players[0] ?? null
    game.currentPlayerIndex = 0
    expect(game.simulatePlaceFollower(westPlace)).toBe(false)
  })

  it('не объединяет сплошной город тайла C с несколькими городами', () => {
    const game = new GameManager({ players: makePlayers() })
    game.temporaryObjects.cities = []
    game.temporaryObjects.roads = []
    game.temporaryObjects.monasteries = []
    game.temporaryObjects.gardens = []
    game.tilePlacesStats[15] = {
      15: {
        id: TileId.C,
        rotation: 0,
        x: 15,
        y: 15,
        sides: {
          [SideName.North]: TileSideType.City,
          [SideName.East]: TileSideType.City,
          [SideName.South]: TileSideType.City,
          [SideName.West]: TileSideType.City,
        },
      },
    }

    game.checkGridAfterPlacingTile(15, 15)

    expect(game.temporaryObjects.cities).toHaveLength(1)
    expect(game.temporaryObjects.cities[0]?.points).toHaveLength(4)
  })

  it('объединяет обе стороны прямой дороги D в один объект', () => {
    const game = new GameManager({ players: makePlayers() })
    game.temporaryObjects.cities = []
    game.temporaryObjects.roads = []
    game.temporaryObjects.monasteries = []
    game.temporaryObjects.gardens = []
    const tile: Tile = {
      id: TileId.D,
      rotation: 0,
      sides: {
        [SideName.North]: TileSideType.City,
        [SideName.East]: TileSideType.Road,
        [SideName.South]: TileSideType.Field,
        [SideName.West]: TileSideType.Road,
      },
    }
    game.tilePlacesStats[15] = {
      15: { ...tile, x: 15, y: 15 },
    }
    game.checkGridAfterPlacingTile(15, 15)
    const eastRoad = game.temporaryObjects.roads.find((road) =>
      road.points.some((point) => point.direction === SideName.East)
    )
    const westRoad = game.temporaryObjects.roads.find((road) =>
      road.points.some((point) => point.direction === SideName.West)
    )
    expect(eastRoad).toBeDefined()
    expect(westRoad).toBe(eastRoad)
    if (!eastRoad || !westRoad) return

    expect(
      game.simulatePlaceFollower(
        game.availableFollowersPlaces.find(
          (place) => place.point.direction === SideName.East
        ) ?? {
          point: { x: 15, y: 15, direction: SideName.East },
          temporaryObject: eastRoad,
        }
      )
    ).toBe(true)
    game.currentPlayer = game.players[1] ?? null
    game.currentPlayerIndex = 1
    expect(
      game.simulatePlaceFollower(
        game.availableFollowersPlaces.find(
          (place) => place.point.direction === SideName.West
        ) ?? {
          point: { x: 15, y: 15, direction: SideName.West },
          temporaryObject: westRoad,
        }
      )
    ).toBe(false)
  })

  it('не позволяет изменить заявку, подменив занятый объект города', () => {
    const game = new GameManager({ players: makePlayers() })
    game.temporaryObjects.cities = []
    game.temporaryObjects.roads = []
    game.temporaryObjects.monasteries = []
    game.temporaryObjects.gardens = []
    const tile: Tile = {
      id: TileId.F,
      rotation: 0,
      sides: {
        [SideName.North]: TileSideType.Field,
        [SideName.East]: TileSideType.City,
        [SideName.South]: TileSideType.Field,
        [SideName.West]: TileSideType.City,
      },
    }
    game.tilePlacesStats[15] = {
      15: { ...tile, x: 15, y: 15 },
    }
    game.checkGridAfterPlacingTile(15, 15)
    const eastCity = game.temporaryObjects.cities.find((city) =>
      city.points.some((point) => point.direction === SideName.East)
    )
    const westCity = game.temporaryObjects.cities.find((city) =>
      city.points.some((point) => point.direction === SideName.West)
    )
    expect(eastCity).toBeDefined()
    expect(westCity).toBeDefined()
    expect(eastCity).toBe(westCity)
    if (!eastCity || !westCity) return

    const eastFollowerPlace = game.availableFollowersPlaces.find(
      (place) => place.point.direction === SideName.East
    )
    expect(eastFollowerPlace).toBeUndefined()
    const followersBefore = game.playersFollowers[1]?.ordinaryFollowers
    expect(
      game.simulatePlaceFollower({
        point: { x: 15, y: 15, direction: SideName.East },
        temporaryObject: {
          ...westCity,
          id: 'forged-city',
          followers: [],
        },
      })
    ).toBe(false)
    expect(game.playersFollowers[1]?.ordinaryFollowers).toBe(followersBefore)
  })

  it.each([TileSideType.City, TileSideType.Road] as const)(
    'убирает маркер при завершении %s, даже если ID объекта изменился',
    (feature) => {
      const game = new GameManager({ players: makePlayers() })
      game.temporaryObjects.cities = []
      game.temporaryObjects.roads = []
      const followerPoint = {
        x: 14,
        y: 15,
        direction:
          feature === TileSideType.City ? SideName.North : SideName.East,
      } as const
      const object: BaseObject = {
        id: `completed-${feature}`,
        points: [
          followerPoint,
          feature === TileSideType.City
            ? { x: 14, y: 14, direction: SideName.South }
            : { x: 15, y: 15, direction: SideName.West },
        ],
        followers: [
          {
            playerId: 1,
            objectId: 'old-merged-id',
            point: followerPoint,
          },
        ],
      }
      game.playersFollowers[1]!.ordinaryFollowers = 6
      game.temporaryObjects[
        feature === TileSideType.City ? 'cities' : 'roads'
      ].push(object)
      game.placedFollowers.push({
        playerId: 1,
        objectId: 'old-merged-id',
        point: followerPoint,
      })

      if (feature === TileSideType.City) game.checkCompleteCity(object)
      else game.checkCompleteRoad(object)

      expect(game.placedFollowers).toHaveLength(0)
      expect(game.playersFollowers[1]?.ordinaryFollowers).toBe(7)
    }
  )
})
