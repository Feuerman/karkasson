import { describe, expect, it } from 'vitest'
import { riverTiles } from '@server/data/riverTiles'
import { GameManager } from '@server/modules/GameManager'
import { SideName, TileId } from '@server/modules/types'
import type { Tile } from '@server/modules/types'
import { makePlayers } from '../helpers/fixtures'
import { rotatedCopies } from '../helpers/board'

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

/** Первый поворот, при котором у тайла есть (или нет) русло на северной стороне */
function rotationWithNorthRiver(
  game: GameManager,
  tile: Tile,
  hasNorthRiver: boolean
): Tile {
  for (const candidate of rotatedCopies(game, tile)) {
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

/** Отказ сервера: размещение не проходит, клетка остаётся свободной */
function expectRejected(
  game: GameManager,
  tile: Tile,
  row: number,
  col: number
): void {
  expect(game.placeTile(tile, row, col)).toBe(false)
  expect(game.tilePlacesStats[row]?.[col]).toBeUndefined()
}

describe('Диагностика отказа по правилам реки', () => {
  it('указывает незакрытый конец русла для клетки вне открытого конца', () => {
    const { game, currentTile } = startRiverGame()

    // Открытый конец стартового истока смотрит на юг в (16,15);
    // клетка (15,16) к нему не примыкает ни при каком повороте.
    expect(game.getPlacementConflicts({ ...currentTile }, 15, 16)).toEqual([
      { reason: 'openEnd', rowIndex: 15, tileIndex: 15, side: SideName.South },
    ])
    expectRejected(game, { ...currentTile }, 15, 16)
  })

  it('указывает не ту сторону русла, когда русло не выходит к открытому концу', () => {
    const { game, currentTile } = startRiverGame()
    const rotated = rotationWithNorthRiver(game, currentTile, false)

    expect(game.getPlacementConflicts(rotated, 16, 15)).toEqual([
      {
        reason: 'wrongSide',
        rowIndex: 15,
        tileIndex: 15,
        side: SideName.South,
      },
    ])
    expectRejected(game, rotated, 16, 15)
  })

  it('отклоняет русло, выходящее вверх, и принимает поворот с выходом вниз', () => {
    const { game } = startRiverGame()
    const bend = riverTile(TileId.RIVER_J)
    const houseBend = riverTile(TileId.RIVER_G)
    const curved = riverTile(TileId.RIVER_I)

    expect(game.placeTile({ ...bend, rotation: 270 }, 16, 15)).toBe(true)

    expect(
      game.getPlacementConflicts({ ...houseBend, rotation: 0 }, 16, 16)
    ).toEqual([
      { reason: 'wrongSide', rowIndex: 16, tileIndex: 15, side: SideName.East },
    ])
    expectRejected(game, { ...houseBend, rotation: 0 }, 16, 16)

    expect(game.placeTile({ ...curved, rotation: 90 }, 16, 16)).toBe(true)
  })

  it('не сообщает причин для валидного продолжения русла и занятой клетки', () => {
    const { game, currentTile } = startRiverGame()
    const rotated = rotationWithNorthRiver(game, currentTile, true)

    expect(game.getPlacementConflicts(rotated, 16, 15)).toEqual([])
    expect(game.getPlacementConflicts(rotated, 15, 15)).toEqual([])
    expect(game.placeTile(rotated, 16, 15)).toBe(true)
  })
})
