import { describe, expect, it } from 'vitest'
import tiles from '../../server/src/data/tiles'
import { innsAndCathedralsTiles } from '../../server/src/data/innsAndCathedralsTiles'
import { GameManager } from '../../server/src/modules/GameManager'
import type {
  BaseObject,
  Point,
  Player,
  Tile,
} from '../../server/src/modules/types'

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
      id: 'J',
      rotation: 90,
      sides: {
        north: 'field',
        west: 'road',
        south: 'field',
        east: 'city',
      },
    }

    expect(game.isCorrectTilePosition(rotatedTile, 15, 16)).toBe(true)
  })

  it('по-прежнему отклоняет тайл с несовпадающей стороной', () => {
    const game = new GameManager({ players: makePlayers() })

    const tile: Tile = {
      id: 'X',
      rotation: 0,
      sides: {
        north: 'field',
        west: 'city',
        south: 'field',
        east: 'city',
      },
    }

    // Запад должен быть road (E.east), а тут city — размещение невалидно.
    expect(game.isCorrectTilePosition(tile, 15, 16)).toBe(false)
  })
})

describe('Проверка размещения и возврата подданных', () => {
  it.each([
    {
      id: 'L',
      sides: { north: 'city', east: 'road', south: 'road', west: 'road' },
      expectedDirections: ['north', 'south', 'west'],
    },
    {
      id: 'W',
      sides: { north: 'field', east: 'road', south: 'road', west: 'road' },
      expectedDirections: ['south', 'west'],
    },
    {
      id: 'X',
      sides: { north: 'road', east: 'road', south: 'road', west: 'road' },
      expectedDirections: ['north', 'south', 'west'],
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
        north: { x, y: y - 1, toward: 'south', away: 'north' },
        east: { x: x + 1, y, toward: 'west', away: 'east' },
        south: { x, y: y + 1, toward: 'north', away: 'south' },
        west: { x: x - 1, y, toward: 'east', away: 'west' },
      } as const

      for (const direction of ['north', 'east', 'south', 'west'] as const) {
        if (sides[direction] !== 'road') continue

        const neighbor = neighbors[direction]
        const neighborSides = {
          north: 'field',
          east: 'field',
          south: 'field',
          west: 'field',
          [neighbor.toward]: 'road',
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
            direction === 'east'
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
      for (const feature of ['road', 'city'] as const) {
        for (let turns = 0; turns < 4; turns += 1) {
          let rotatedTile = { ...definition, rotation: 0 }
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

          if (feature === 'road' && featureSides.length >= 3) {
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
      for (const feature of ['road', 'city'] as const) {
        for (let turns = 0; turns < 4; turns += 1) {
          let rotatedTile = { ...definition, rotation: 0 }
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
    const expectedGroups: Record<
      string,
      { road: string[][]; city: string[][] }
    > = {
      'IAC-A': { road: [['south', 'west']], city: [] },
      'IAC-B': { road: [['east', 'west']], city: [] },
      'IAC-C': {
        road: [['east'], ['south'], ['west']],
        city: [],
      },
      'IAC-D': { road: [['east'], ['west']], city: [] },
      'IAC-E': {
        road: [
          ['north', 'west'],
          ['east', 'south'],
        ],
        city: [],
      },
      'IAC-F': {
        road: [['east']],
        city: [['north', 'west']],
      },
      'IAC-G': { road: [], city: [['west']] },
      'IAC-H': {
        road: [],
        city: [['north'], ['east'], ['south'], ['west']],
      },
      'IAC-I': {
        road: [['east'], ['west']],
        city: [['north'], ['south']],
      },
      'IAC-J': { road: [['south']], city: [['north']] },
      'IAC-Ka': {
        road: [],
        city: [['north', 'east', 'south', 'west']],
      },
      'IAC-Kb': {
        road: [],
        city: [['north', 'east', 'south', 'west']],
      },
      'IAC-L': {
        road: [['east', 'south']],
        city: [['north', 'west']],
      },
      'IAC-M': {
        road: [['south', 'west']],
        city: [['north']],
      },
      'IAC-N': {
        road: [['south']],
        city: [['north', 'west']],
      },
      'IAC-O': {
        road: [],
        city: [['north'], ['east'], ['west']],
      },
      'IAC-P': {
        road: [],
        city: [['north', 'west'], ['south']],
      },
      'IAC-Q': {
        road: [['north'], ['south']],
        city: [['east', 'west']],
      },
    }

    expect(Object.keys(expectedGroups).sort()).toEqual(
      innsAndCathedralsTiles.map(({ id }) => id).sort()
    )
    for (const definition of innsAndCathedralsTiles) {
      for (const feature of ['road', 'city'] as const) {
        expect(
          game.getTileFeatureGroups({ ...definition, rotation: 0 }, feature),
          `${definition.id} ${feature}`
        ).toEqual(expectedGroups[definition.id]?.[feature])
      }

      const roadSides = Object.entries(definition.sides)
        .filter(([, sideType]) => sideType === 'road')
        .map(([side]) => side)
      const citySides = Object.entries(definition.sides)
        .filter(([, sideType]) => sideType === 'city')
        .map(([side]) => side)
      for (const [feature, groups, validSides] of [
        ['road', definition.roadGroups, roadSides],
        ['city', definition.cityGroups, citySides],
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
      rules: { expansions: { innsAndCathedrals: true } },
    })
    const getExpansionTile = (id: string) => {
      const definition = innsAndCathedralsTiles.find((tile) => tile.id === id)
      if (!definition) throw new Error(`Tile ${id} is missing`)
      return { ...definition, rotation: 0 }
    }

    expect(
      game.getTileFeatureGroups(getExpansionTile('IAC-E'), 'road')
    ).toEqual([
      ['north', 'west'],
      ['east', 'south'],
    ])
    expect(
      game.getTileFeatureGroups(getExpansionTile('IAC-I'), 'road')
    ).toEqual([['east'], ['west']])
    expect(
      game.getTileFeatureGroups(
        game.rotateTile(getExpansionTile('IAC-E')),
        'road'
      )
    ).toEqual([
      ['east', 'north'],
      ['south', 'west'],
    ])
  })

  it('описывает два отдельных города IAC-P и относит герб к одному из них', () => {
    const tile = innsAndCathedralsTiles.find(({ id }) => id === 'IAC-P')
    if (!tile) throw new Error('Tile IAC-P is missing')
    const game = new GameManager({
      players: makePlayers(),
      startImmediately: false,
      rules: { expansions: { innsAndCathedrals: true } },
    })

    expect(game.getTileFeatureGroups({ ...tile, rotation: 0 }, 'city')).toEqual(
      [['north', 'west'], ['south']]
    )
    expect(tile.cityShieldGroups).toEqual([['north', 'west']])
  })

  it('предлагает все незанятые группы для всех типов каталожных тайлов и поворотов', () => {
    for (const definition of tiles) {
      for (let turns = 0; turns < 4; turns += 1) {
        const game = new GameManager({
          players: makePlayers(),
          startImmediately: false,
        })
        let tile = { ...definition, rotation: 0 }
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
        for (const feature of ['road', 'city'] as const) {
          const collection = feature === 'road' ? 'roads' : 'cities'
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
          expectedDirections.push('center')
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
      id: 'P',
      occupiedFeature: 'road',
      expectedAvailable: ['north', 'west'],
    },
    {
      id: 'P',
      occupiedFeature: 'city',
      expectedAvailable: ['east', 'south'],
    },
    {
      id: 'H',
      occupiedFeature: 'city',
      expectedAvailable: ['south'],
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

      for (const feature of ['road', 'city'] as const) {
        const collection = feature === 'road' ? 'roads' : 'cities'
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
      id: 'F',
      rotation: 0,
      sides: { north: 'field', east: 'city', south: 'field', west: 'city' },
      cityGroups: [['east'], ['west']],
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

  it.each(['city', 'road'] as const)(
    'не позволяет повторно занять уже занятую связанную %s',
    (feature) => {
      const game = new GameManager({ players: makePlayers() })
      game.temporaryObjects.cities = []
      game.temporaryObjects.roads = []
      const point: Point = {
        x: 15,
        y: 15,
        direction: feature === 'city' ? 'north' : 'east',
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
      game.temporaryObjects[feature === 'city' ? 'cities' : 'roads'].push(
        object
      )
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
    const firstPoint: Point = { x: 15, y: 15, direction: 'north' }
    const secondPoint: Point = { x: 15, y: 15, direction: 'east' }
    const city: BaseObject = {
      id: 'shared-city',
      points: [firstPoint, secondPoint],
      followers: [{ playerId: 1, objectId: 'shared-city', point: firstPoint }],
    }
    game.tilePlacesStats[15] = {
      15: {
        id: 'M',
        rotation: 0,
        x: 15,
        y: 15,
        sides: { north: 'city', east: 'city', south: 'field', west: 'field' },
        cityGroups: [['north', 'east']],
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
        id: 'H',
        rotation: 0,
        x: 15,
        y: 15,
        sides: { north: 'city', east: 'field', south: 'city', west: 'field' },
      },
    }

    game.checkGridAfterPlacingTile(15, 15)

    expect(game.temporaryObjects.cities).toHaveLength(2)
    const northCity = game.temporaryObjects.cities.find((city) =>
      city.points.some((point) => point.direction === 'north')
    )
    const southCity = game.temporaryObjects.cities.find((city) =>
      city.points.some((point) => point.direction === 'south')
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
        id: 'D',
        rotation: 0,
        x: 15,
        y: 15,
        sides: { north: 'city', east: 'road', south: 'field', west: 'road' },
        roadGroups: [['east'], ['west']],
        cityGroups: [['north']],
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
      id: 'F',
      rotation: 0,
      sides: { north: 'field', east: 'city', south: 'field', west: 'city' },
    }
    game.tilePlacesStats[15] = {
      15: { ...tile, x: 15, y: 15 },
    }
    game.checkGridAfterPlacingTile(15, 15)
    const westCity = game.temporaryObjects.cities.find((city) =>
      city.points.some((point) => point.direction === 'west')
    )
    const eastCity = game.temporaryObjects.cities.find((city) =>
      city.points.some((point) => point.direction === 'east')
    )
    expect(westCity).toBeDefined()
    expect(eastCity).toBe(westCity)
    if (!westCity || !eastCity) return

    const eastPlace = {
      point: { x: 15, y: 15, direction: 'east' as const },
      temporaryObject: eastCity,
    }
    game.currentPlayer = game.players[1] ?? null
    game.currentPlayerIndex = 1
    expect(game.simulatePlaceFollower(eastPlace)).toBe(true)
    const westPlace = {
      point: { x: 15, y: 15, direction: 'west' as const },
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
        id: 'C',
        rotation: 0,
        x: 15,
        y: 15,
        sides: { north: 'city', east: 'city', south: 'city', west: 'city' },
      },
    }

    game.checkGridAfterPlacingTile(15, 15)

    expect(game.temporaryObjects.cities).toHaveLength(1)
    expect(game.temporaryObjects.cities[0]?.points).toHaveLength(4)
  })

  it('разрешает выставлять фишку в обе стороны прямой дороги D', () => {
    const game = new GameManager({ players: makePlayers() })
    game.temporaryObjects.cities = []
    game.temporaryObjects.roads = []
    game.temporaryObjects.monasteries = []
    game.temporaryObjects.gardens = []
    const tile: Tile = {
      id: 'D',
      rotation: 0,
      sides: { north: 'city', east: 'road', south: 'field', west: 'road' },
    }
    game.tilePlacesStats[15] = {
      15: { ...tile, x: 15, y: 15 },
    }
    game.checkGridAfterPlacingTile(15, 15)
    const eastRoad = game.temporaryObjects.roads.find((road) =>
      road.points.some((point) => point.direction === 'east')
    )
    const westRoad = game.temporaryObjects.roads.find((road) =>
      road.points.some((point) => point.direction === 'west')
    )
    expect(eastRoad).toBeDefined()
    expect(westRoad).not.toBe(eastRoad)
    if (!eastRoad || !westRoad) return

    expect(
      game.simulatePlaceFollower(
        game.availableFollowersPlaces.find(
          (place) => place.point.direction === 'east'
        ) ?? {
          point: { x: 15, y: 15, direction: 'east' },
          temporaryObject: eastRoad,
        }
      )
    ).toBe(true)
    game.currentPlayer = game.players[1] ?? null
    game.currentPlayerIndex = 1
    expect(
      game.simulatePlaceFollower(
        game.availableFollowersPlaces.find(
          (place) => place.point.direction === 'west'
        ) ?? {
          point: { x: 15, y: 15, direction: 'west' },
          temporaryObject: westRoad,
        }
      )
    ).toBe(true)
  })

  it('не позволяет изменить заявку, подменив занятый объект города', () => {
    const game = new GameManager({ players: makePlayers() })
    game.temporaryObjects.cities = []
    game.temporaryObjects.roads = []
    game.temporaryObjects.monasteries = []
    game.temporaryObjects.gardens = []
    const tile: Tile = {
      id: 'F',
      rotation: 0,
      sides: { north: 'field', east: 'city', south: 'field', west: 'city' },
    }
    game.tilePlacesStats[15] = {
      15: { ...tile, x: 15, y: 15 },
    }
    game.checkGridAfterPlacingTile(15, 15)
    const eastCity = game.temporaryObjects.cities.find((city) =>
      city.points.some((point) => point.direction === 'east')
    )
    const westCity = game.temporaryObjects.cities.find((city) =>
      city.points.some((point) => point.direction === 'west')
    )
    expect(eastCity).toBeDefined()
    expect(westCity).toBeDefined()
    expect(eastCity).toBe(westCity)
    if (!eastCity || !westCity) return

    const eastFollowerPlace = game.availableFollowersPlaces.find(
      (place) => place.point.direction === 'east'
    )
    expect(eastFollowerPlace).toBeUndefined()
    const followersBefore = game.playersFollowers[1]?.ordinaryFollowers
    expect(
      game.simulatePlaceFollower({
        point: { x: 15, y: 15, direction: 'east' },
        temporaryObject: {
          ...westCity,
          id: 'forged-city',
          followers: [],
        },
      })
    ).toBe(false)
    expect(game.playersFollowers[1]?.ordinaryFollowers).toBe(followersBefore)
  })

  it.each(['city', 'road'] as const)(
    'убирает маркер при завершении %s, даже если ID объекта изменился',
    (feature) => {
      const game = new GameManager({ players: makePlayers() })
      game.temporaryObjects.cities = []
      game.temporaryObjects.roads = []
      const followerPoint = {
        x: 14,
        y: 15,
        direction: feature === 'city' ? 'north' : 'east',
      } as const
      const object: BaseObject = {
        id: `completed-${feature}`,
        points: [
          followerPoint,
          feature === 'city'
            ? { x: 14, y: 14, direction: 'south' }
            : { x: 15, y: 15, direction: 'west' },
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
      game.temporaryObjects[feature === 'city' ? 'cities' : 'roads'].push(
        object
      )
      game.placedFollowers.push({
        playerId: 1,
        objectId: 'old-merged-id',
        point: followerPoint,
      })

      if (feature === 'city') game.checkCompleteCity(object)
      else game.checkCompleteRoad(object)

      expect(game.placedFollowers).toHaveLength(0)
      expect(game.playersFollowers[1]?.ordinaryFollowers).toBe(7)
    }
  )
})
