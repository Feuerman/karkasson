import { describe, expect, it } from 'vitest'
import { riverTiles } from '@server/data/riverTiles'
import { ExpansionName, SideName, TileId } from '@server/modules/types'
import { rotateTileGroups } from '@server/modules/tileRotation'
import { GameManager } from '@server/modules/GameManager'
import tiles from '@server/data/tiles'
import type { Tile } from '@server/modules/types'

describe('Тайлы дополнения «Река»', () => {
  it('содержит отдельные описания для всех предоставленных изображений', () => {
    expect(riverTiles).toHaveLength(11)
    expect(new Set(riverTiles.map(({ id }) => id)).size).toBe(riverTiles.length)
    expect(riverTiles.reduce((count, tile) => count + tile.count, 0)).toBe(12)
    expect(
      riverTiles.every(
        (tile) =>
          tile.expansion === ExpansionName.River &&
          tile.imgUrl?.startsWith('/src/assets/tiles/river/') &&
          tile.riverGroups?.length
      )
    ).toBe(true)
  })

  it('описывает особые свойства тайлов K и L', () => {
    const innTile = riverTiles.find(({ id }) => id === TileId.RIVER_K)
    const monasteryTile = riverTiles.find(({ id }) => id === TileId.RIVER_L)

    expect(innTile).toMatchObject({
      hasInn: true,
      roadGroups: [[expect.any(String), expect.any(String)]],
    })
    expect(monasteryTile).toMatchObject({ isMonastery: true })
  })

  it('задаёт стороны выхода русла, которые можно поворачивать', () => {
    const tile = riverTiles.find(({ id }) => id === TileId.RIVER_B)
    expect(tile).toBeDefined()
    if (!tile) return

    expect(rotateTileGroups(tile.riverGroups, 1)).toEqual([
      [SideName.South, SideName.North],
    ])
  })

  it('добавляет реку перед базовой колодой и ставит исток вместо стартового тайла', () => {
    const game = new GameManager({
      riverEnabled: true,
      startImmediately: false,
    })
    game.startGame()
    const riverEndIndex = game.tilesList.findIndex(
      ({ id }) => id === TileId.RIVER_L
    )

    expect(game.rules.expansions.river).toBe(true)
    expect(game.tileHistory[0]?.id).toBe(TileId.RIVER_A)
    expect(game.currentTile?.expansion).toBe(ExpansionName.River)
    expect(
      game.tilesList.filter(
        ({ expansion }) => expansion === ExpansionName.River
      )
    ).toHaveLength(10)
    expect(
      game.tilesList
        .slice(0, riverEndIndex)
        .every(({ expansion }) => expansion === ExpansionName.River)
    ).toBe(true)
    expect(game.tilesList[riverEndIndex + 1]?.id).toBeDefined()
    expect(
      tiles.some(({ id }) => id === game.tilesList[riverEndIndex + 1]?.id)
    ).toBe(true)
  })

  it('перемешивает средние тайлы реки при генерации колоды', () => {
    const random = Math.random
    Math.random = () => 0
    try {
      const game = new GameManager({
        riverEnabled: true,
        startImmediately: false,
      })
      const riverEndIndex = game.tilesList.findIndex(
        ({ id }) => id === TileId.RIVER_L
      )
      const generatedRiverIds = game.tilesList
        .slice(0, riverEndIndex)
        .map(({ id }) => id)
      const catalogRiverIds = riverTiles
        .filter(({ id }) => id !== TileId.RIVER_L)
        .flatMap(({ id, count }) => Array.from({ length: count }, () => id))

      expect(generatedRiverIds).not.toEqual(catalogRiverIds)
      expect(game.tilesList[riverEndIndex]?.id).toBe(TileId.RIVER_L)
    } finally {
      Math.random = random
    }
  })

  it('сохраняет hasGarden речного тайла при генерации колоды', () => {
    const game = new GameManager({
      riverEnabled: true,
      startImmediately: false,
    })
    const riverGardenTiles = game.tilesList.filter(
      ({ id, expansion, hasGarden }) =>
        id === TileId.RIVER_J && expansion === ExpansionName.River && hasGarden
    )

    expect(riverGardenTiles).toHaveLength(1)
    expect(riverTiles.find(({ id }) => id === TileId.RIVER_J)?.hasGarden).toBe(
      true
    )
  })

  it('разрешает только продолжение открытого русла до конечного озера', () => {
    const game = new GameManager({
      riverEnabled: true,
      startImmediately: false,
    })
    game.startGame()
    const straightRiver = riverTiles.find(({ id }) => id === TileId.RIVER_D)
    const monasteryTile = tiles.find(({ id }) => id === TileId.B)
    if (!straightRiver || !monasteryTile)
      throw new Error('Test tile is missing')

    expect(game.placeTile({ ...straightRiver, rotation: 90 }, 16, 15)).toBe(
      false
    )
    expect(game.placeTile({ ...straightRiver, rotation: 0 }, 16, 15)).toBe(true)
    expect(game.placeTile({ ...monasteryTile, rotation: 0 }, 17, 15)).toBe(
      false
    )

    const riverEnd = riverTiles.find(({ id }) => id === TileId.RIVER_L)
    if (!riverEnd) throw new Error('River end tile is missing')
    expect(game.placeTile({ ...riverEnd, rotation: 0 }, 17, 15)).toBe(true)
    expect(game.placeTile({ ...monasteryTile, rotation: 0 }, 18, 15)).toBe(true)
  })

  it('продолжает русло после поворота J по фактическим выходам изображения', () => {
    const game = new GameManager({
      riverEnabled: true,
      startImmediately: false,
    })
    game.startGame()
    const riverBend = riverTiles.find(({ id }) => id === TileId.RIVER_J)
    const straightRiver = riverTiles.find(({ id }) => id === TileId.RIVER_D)
    if (!riverBend || !straightRiver) throw new Error('River tile is missing')

    expect(game.placeTile({ ...riverBend, rotation: 270 }, 16, 15)).toBe(true)
    expect(game.placeTile({ ...straightRiver, rotation: 90 }, 16, 16)).toBe(
      true
    )
  })

  it('разрешает продолжить русло влево после поворота', () => {
    const game = new GameManager({
      riverEnabled: true,
      startImmediately: false,
    })
    game.startGame()
    const straightRiver = riverTiles.find(({ id }) => id === TileId.RIVER_D)
    const riverBend = riverTiles.find(({ id }) => id === TileId.RIVER_G)
    const horizontalRiver = riverTiles.find(({ id }) => id === TileId.RIVER_B)
    if (!straightRiver || !riverBend || !horizontalRiver)
      throw new Error('River tile is missing')

    expect(game.placeTile({ ...straightRiver, rotation: 0 }, 16, 15)).toBe(true)
    expect(game.placeTile({ ...riverBend, rotation: 0 }, 17, 15)).toBe(true)
    expect(game.placeTile({ ...horizontalRiver, rotation: 0 }, 17, 14)).toBe(
      true
    )
  })

  it('не поворачивает тайл при выдаче и отклоняет речной ход назад', () => {
    const game = new GameManager({
      riverEnabled: true,
      startImmediately: false,
      players: [
        {
          id: 1,
          name: 'Alice',
          color: 'red',
          score: 0,
          socketId: 's1',
          deviceId: 'd1',
        },
      ],
    })
    game.startGame()
    const riverBend = riverTiles.find(({ id }) => id === TileId.RIVER_B)
    const riverEnd = riverTiles.find(({ id }) => id === TileId.RIVER_L)
    if (!riverBend || !riverEnd) throw new Error('River tile is missing')

    game.tilesList = [
      { ...riverBend, rotation: 0 },
      { ...riverEnd, rotation: 0 },
    ]
    game.getRandomTileFromList()

    expect(game.currentTile?.id).toBe(TileId.RIVER_B)
    expect(game.currentTile?.rotation).toBe(0)
    const currentTile = game.currentTile
    if (!currentTile) throw new Error('Expected a river tile to be drawn')
    expect(game.placeTile(currentTile, 16, 15)).toBe(false)
  })

  it('выкладывает все речные тайлы по очереди и завершает реку озером', () => {
    const random = Math.random
    Math.random = () => 0.5
    try {
      const game = new GameManager({
        riverEnabled: true,
        startImmediately: false,
        players: [
          {
            id: 1,
            name: 'Alice',
            color: 'red',
            score: 0,
            socketId: 's1',
            deviceId: 'd1',
          },
        ],
      })
      const middleRiverTiles = riverTiles
        .filter(({ id }) => id !== TileId.RIVER_A && id !== TileId.RIVER_L)
        .flatMap((tile) =>
          Array.from({ length: tile.count }, () => ({ ...tile, rotation: 0 }))
        )
      const riverEndDefinition = riverTiles.find(
        ({ id }) => id === TileId.RIVER_L
      )
      const baseTile = tiles.find(({ id }) => id === TileId.B)
      if (!baseTile || !riverEndDefinition)
        throw new Error('Test tile is missing')
      const riverDeck = [
        ...middleRiverTiles,
        { ...riverEndDefinition, rotation: 0 },
      ]
      game.tilesList = [...riverDeck, { ...baseTile, rotation: 0 }]
      game.startGame()

      expect(game.tileHistory[0]?.id).toBe(TileId.RIVER_A)
      let riverTileCount = 0
      let turnCount = 0

      while (riverTileCount < riverDeck.length) {
        turnCount += 1
        expect(turnCount).toBeLessThanOrEqual(riverDeck.length)
        const currentTile = game.currentTile
        expect(
          currentTile,
          'the next river tile should be visible'
        ).not.toBeNull()
        if (!currentTile) throw new Error('Expected a river tile to be drawn')
        expect(currentTile?.id).toBe(riverDeck[riverTileCount]?.id)

        let placed = false
        for (const place of game.availablePlacesTiles) {
          for (let rotation = 0; rotation < 4 && !placed; rotation += 1) {
            let candidate: Tile = { ...currentTile }
            for (let turn = 0; turn < rotation; turn += 1) {
              candidate = game.rotateTile(candidate)
            }
            if (game.placeTile(candidate, place.rowIndex, place.tileIndex)) {
              placed = true
            }
          }
          if (placed) break
        }

        expect(placed, `could not place ${currentTile.id}`).toBe(true)
        riverTileCount += 1
        if (game.isPlacingFollower) game.skipFollower()
      }

      expect(riverTileCount).toBe(riverDeck.length)
      expect(game.gameIsEnded).toBe(false)
      expect(
        Object.values(game.tilePlacesStats)
          .flatMap((row) => Object.values(row))
          .filter(({ expansion }) => expansion === ExpansionName.River)
      ).toHaveLength(riverDeck.length + 1)
      expect(game.tileHistory[riverDeck.length]?.id).toBe(TileId.RIVER_L)
      expect(
        game.tileHistory.slice(1, riverDeck.length + 1).map(({ id }) => id)
      ).toEqual(riverDeck.map(({ id }) => id))
      expect(game.currentTile?.id).toBe(TileId.B)
      expect(game.currentTile?.expansion).toBeUndefined()
    } finally {
      Math.random = random
    }
  })
})
