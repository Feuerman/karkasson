import { describe, expect, it } from 'vitest'
import {
  getDragonTurnNumber,
  getPlayerTurnNumber,
} from '@server/modules/turnNumber'
import { getCurrentTurnNumber } from '@/utils/turnNumber'

describe('getPlayerTurnNumber', () => {
  it('нумерует ходы игроков сквозь раунды', () => {
    expect(getPlayerTurnNumber(1, 0, 4)).toBe(1)
    expect(getPlayerTurnNumber(1, 3, 4)).toBe(4)
    expect(getPlayerTurnNumber(2, 0, 4)).toBe(5)
    expect(getPlayerTurnNumber(3, 1, 4)).toBe(10)
  })

  it('поддерживает старые состояния и некорректные значения', () => {
    expect(getPlayerTurnNumber(undefined, undefined, 0)).toBe(1)
    expect(getPlayerTurnNumber(0, -1, 2)).toBe(1)
    expect(getPlayerTurnNumber(2, 5, 2)).toBe(4)
  })
})

describe('getDragonTurnNumber', () => {
  it('относит шаги дракона к ходу поставившего вулкан', () => {
    expect(getDragonTurnNumber(2, 1, 4)).toBe(5)
    expect(getDragonTurnNumber(2, 2, 4)).toBe(6)
    expect(getDragonTurnNumber(2, 3, 4)).toBe(7)
  })

  it('учитывает переход раунда после последнего игрока', () => {
    expect(getDragonTurnNumber(2, 0, 4)).toBe(4)
    expect(getDragonTurnNumber(3, 0, 4)).toBe(8)
  })
})

describe('getCurrentTurnNumber', () => {
  const players = [{}, {}, {}, {}]

  it('берёт ход текущего игрока вне движения дракона', () => {
    expect(
      getCurrentTurnNumber({
        moveCounter: 2,
        currentPlayerIndex: 0,
        players,
      })
    ).toBe(5)
  })

  it('не меняет номер хода, пока дракон переходит между игроками', () => {
    expect(
      getCurrentTurnNumber({
        moveCounter: 2,
        currentPlayerIndex: 2,
        players,
        dragonMove: { resumePlayerIndex: 1 },
      })
    ).toBe(5)
  })

  it('учитывает раунд, если вулкан поставил последний игрок', () => {
    expect(
      getCurrentTurnNumber({
        moveCounter: 3,
        currentPlayerIndex: 2,
        players,
        dragonMove: { resumePlayerIndex: 0 },
      })
    ).toBe(8)
  })
})
