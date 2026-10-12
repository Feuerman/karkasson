import { describe, expect, it } from 'vitest'
import { riverTiles } from '@server/data/riverTiles'
import { GameManager } from '@server/modules/GameManager'
import { SideName, TileId } from '@server/modules/types'
import type { Tile } from '@server/modules/types'
import { makePlayers } from '../helpers/fixtures'

/**
 * Правила реки проверяются на игре с включённым дополнением: стартовый исток
 * задаёт открытый конец, поэтому отказы зависят от состояния доски, а не
 * только от самого тайла.
 */

function startRiverGame(): { game: GameManager; currentTile: Tile } {
  const game = new GameManager({
    players: makePlayers(),
    riverEnabled: true,
    startImmediately: false,
  })
  game.startGame()
  const currentTile = game.currentTile
  if (!currentTile) throw new Error('Current river tile is missing')
  expect(game.tilePlacesStats[15]?.[15]?.id).toBe(TileId.RIVER_A)
  return { game, currentTile }
}

function rotateTo(game: GameManager, tile: Tile, turns: number): Tile {
  let rotated: Tile = { ...tile, rotation: 0 }
  for (let index = 0; index < turns; index += 1) {
    rotated = game.rotateTile(rotated)
  }
  return rotated
}

/** Первый поворот, при котором у тайла есть (или нет) русло на северной стороне */
function rotationWithNorthRiver(
  game: GameManager,
  tile: Tile,
  hasNorthRiver: boolean
): Tile {
  for (let turns = 0; turns < 4; turns += 1) {
    const candidate = rotateTo(game, tile, turns)
    const hasNorth = Boolean(
      candidate.riverGroups?.flat().includes(SideName.North)
    )
    if (hasNorth === hasNorthRiver) return candidate
  }
  throw new Error(`No rotation with north river = ${hasNorthRiver}`)
}

function riverTile(id: TileId): Tile {
  const found = riverTiles.find((tile) => tile.id === id)
  if (!found) throw new Error(`River tile ${id} is missing`)
  return { ...found, rotation: 0 }
}

describe('Диагностика отказа по правилам реки', () => {
  it('указывает незакрытый конец русла для клетки вне открытого конца', () => {
    const { game, currentTile } = startRiverGame()

    // Открытый конец стартового истока смотрит на юг в (16,15);
    // клетка (15,16) к нему не примыкает ни при каком повороте.
    expect(game.getPlacementFailure({ ...currentTile }, 15, 16)).toEqual([
      { reason: 'openEnd', rowIndex: 15, tileIndex: 15, side: SideName.South },
    ])
    expect(game.placeTile({ ...currentTile }, 15, 16)).toBe(false)
    expect(game.tilePlacesStats[15]?.[16]).toBeUndefined()
  })

  it('указывает не ту сторону русла, когда русло не выходит к открытому концу', () => {
    const { game, currentTile } = startRiverGame()
    const rotated = rotationWithNorthRiver(game, currentTile, false)

    expect(game.getPlacementFailure(rotated, 16, 15)).toEqual([
      {
        reason: 'wrongSide',
        rowIndex: 15,
        tileIndex: 15,
        side: SideName.South,
      },
    ])
    expect(game.placeTile(rotated, 16, 15)).toBe(false)
    expect(game.tilePlacesStats[16]?.[15]).toBeUndefined()
  })

  it('отклоняет русло, выходящее вверх, и принимает поворот с выходом вниз', () => {
    const { game } = startRiverGame()
    const bend = riverTile(TileId.RIVER_J)
    const houseBend = riverTile(TileId.RIVER_G)
    const curved = riverTile(TileId.RIVER_I)

    expect(game.placeTile({ ...bend, rotation: 270 }, 16, 15)).toBe(true)

    expect(
      game.getPlacementFailure({ ...houseBend, rotation: 0 }, 16, 16)
    ).toEqual([
      { reason: 'wrongSide', rowIndex: 16, tileIndex: 15, side: SideName.East },
    ])
    expect(game.placeTile({ ...houseBend, rotation: 0 }, 16, 16)).toBe(false)
    expect(game.tilePlacesStats[16]?.[16]).toBeUndefined()

    expect(game.placeTile({ ...curved, rotation: 90 }, 16, 16)).toBe(true)
  })

  it('не сообщает причин для валидного продолжения русла и занятой клетки', () => {
    const { game, currentTile } = startRiverGame()
    const rotated = rotationWithNorthRiver(game, currentTile, true)

    expect(game.getPlacementFailure(rotated, 16, 15)).toEqual([])
    expect(game.getPlacementFailure(rotated, 15, 15)).toEqual([])
    expect(game.placeTile(rotated, 16, 15)).toBe(true)
  })
})
