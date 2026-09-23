import { describe, expect, it } from 'vitest'
import { GameManager } from '../../server/src/modules/GameManager'
import type { Player, Tile } from '../../server/src/modules/types'

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
