import { describe, expect, it } from 'vitest'
import { GameManager } from '@server/modules/GameManager'
import { SideName, TileId, TileSideType } from '@server/modules/types'
import type {
  Tile,
  TileSideType as Side,
  TileSides,
} from '@server/modules/types'
import { placeTileOnBoard } from '../helpers/board'
import { makePlayers } from '../helpers/fixtures'
import { monasteryTile, sides } from '../helpers/tiles'

/**
 * Условия окончания партии, связанные с колодой: сервер пропускает тайлы без
 * допустимого места и заканчивает партию, когда не подходит ни один тайл.
 * Те же формулировки используются в разделе «Базовая игра» правил.
 */

const players = makePlayers().slice(0, 1)

/** Схема клетки блока 13..17 x 13..17: дороги только на внешней границе. */
function blockSides(row: number, col: number): TileSides {
  const road: Side = TileSideType.Road
  const field: Side = TileSideType.Field
  const block: TileSides = sides(
    row === 13 ? road : field,
    col === 17 ? road : field,
    row === 17 ? road : field,
    col === 13 ? road : field
  )
  // Совпадения с гранями стартового тайла D: город сверху, дороги слева и справа.
  if (row === 14 && col === 15) block[SideName.South] = TileSideType.City
  if (row === 15 && col === 14) block[SideName.East] = road
  if (row === 15 && col === 16) block[SideName.West] = road
  return block
}

/**
 * Плотный блок вокруг стартового тайла, у которого все внешние грани — дороги.
 * Любая свободная соседняя клетка требует дорогу, поэтому тайл без дорог
 * (монастырь) не ложится на доску ни при какой ориентации.
 */
function gameWithRoadBlock(): GameManager {
  const game = new GameManager({ players })
  const cells: [number, number][] = []
  for (let row = 13; row <= 17; row += 1) {
    for (let col = 13; col <= 17; col += 1) {
      if (row === 15 && col === 15) continue
      cells.push([row, col])
    }
  }
  // Стартуем от центра: новая клетка должна примыкать к уже выложенной.
  cells.sort(
    ([rowA, colA], [rowB, colB]) =>
      Math.abs(rowA - 15) +
      Math.abs(colA - 15) -
      Math.abs(rowB - 15) -
      Math.abs(colB - 15)
  )
  for (const [row, col] of cells) {
    expect(
      placeTileOnBoard(
        game,
        { id: 'test', rotation: 0, sides: blockSides(row, col) },
        row,
        col
      ),
      `клетка ${row},${col}`
    ).toBe(true)
  }
  return game
}

function roadTile(): Tile {
  const road = TileSideType.Road
  const field = TileSideType.Field
  return {
    id: TileId.U,
    rotation: 0,
    sides: sides(road, field, road, field),
  }
}

describe('Колода и окончание партии', () => {
  it('откладывает тайл без допустимого места в конец колоды и берёт следующий', () => {
    const game = gameWithRoadBlock()
    game.tilesList = [monasteryTile(), roadTile()]

    game.getRandomTileFromList()

    expect(game.gameIsEnded).toBe(false)
    expect(game.currentTile?.id).toBe(TileId.U)
    expect(game.tilesList.map(({ id }) => id)).toEqual([TileId.B])
  })

  it('заканчивает партию, если ни один оставшийся тайл нельзя выложить', () => {
    const game = gameWithRoadBlock()
    game.tilesList = [monasteryTile(), monasteryTile()]

    game.getRandomTileFromList()

    expect(game.gameIsEnded).toBe(true)
    expect(game.currentTile).toBeNull()
    expect(game.tilesList).toEqual([])
  })
})
