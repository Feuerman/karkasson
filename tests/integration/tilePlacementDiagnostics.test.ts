import { describe, expect, it } from 'vitest'
import tiles from '@server/data/tiles'
import { GameManager } from '@server/modules/GameManager'
import { SideName, TileId, TileSideType } from '@server/modules/types'
import type { Tile } from '@server/modules/types'
import { makePlayers } from '../helpers/fixtures'

/**
 * Размещение тайла проверяется на живом GameManager: он пересказывает
 * аргументы в gameGeometry, и ошибка в этой прослойке не ловится чистыми
 * тестами функций геометрии.
 */

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

describe('Диагностика неудачного размещения тайла', () => {
  it('возвращает конфликтующую сторону и координаты соседа', () => {
    const game = new GameManager({ players: makePlayers() })
    const cityTile = tiles.find(({ id }) => id === TileId.C)
    if (!cityTile) throw new Error('Tile C is missing')

    // Стартовый D на (15,15): восток — дорога. Городской тайл C в клетке
    // (15,16) не совпадает с ней по западной стороне.
    expect(
      game.getPlacementFailure({ ...cityTile, rotation: 0 }, 15, 16)
    ).toEqual([
      {
        side: SideName.West,
        rowIndex: 15,
        tileIndex: 15,
        own: TileSideType.City,
        adjacent: TileSideType.Road,
      },
    ])
  })

  it('возвращает пустой список для подходящего тайла и для занятой клетки', () => {
    const game = new GameManager({ players: makePlayers() })
    const roadTile = tiles.find(({ id }) => id === TileId.L)
    if (!roadTile) throw new Error('Tile L is missing')

    // Запад L — дорога, как и восток стартового D.
    expect(
      game.getPlacementFailure({ ...roadTile, rotation: 0 }, 15, 16)
    ).toEqual([])
    expect(
      game.getPlacementFailure({ ...roadTile, rotation: 0 }, 15, 15)
    ).toEqual([])
  })

  it('не выдаёт причину для тайла, который действительно можно разместить', () => {
    const game = new GameManager({ players: makePlayers() })
    const roadTile = tiles.find(({ id }) => id === TileId.L)
    if (!roadTile) throw new Error('Tile L is missing')
    const tile = { ...roadTile, rotation: 0 }

    expect(game.getPlacementFailure(tile, 15, 16)).toEqual([])
    expect(game.placeTile(tile, 15, 16)).toBe(true)
    expect(game.tilePlacesStats[15]?.[16]).toBeDefined()
  })
})
