import { describe, expect, it } from 'vitest'
import { ActionTypes, ObjectTypes, type Player } from '@server/modules/types'
import type { GameAction } from '@server/modules/gameActions'
import { buildGameResults, buildScoreBreakdown } from '@/utils/gameResults'

/**
 * Итоги партии собираются из снимка сервера: очки — по счёту, разбивка по
 * источникам — по записям истории о начислении очков.
 */

const player = (id: number, name: string): Player => ({
  id,
  name,
  color: 'coral',
  score: 0,
  socketId: `socket-${id}`,
  deviceId: `device-${id}`,
})

const addingScores = (
  objectType: ObjectTypes,
  points: Record<string, number>
): GameAction => ({
  actionType: ActionTypes.ADDING_SCORES,
  actionData: {
    objectType,
    objectData: { id: 'object-1', points: [], followers: [] },
    score: {
      total: Object.values(points).reduce((sum, value) => sum + value, 0),
      players: points,
    },
  },
})

const placeTile: GameAction = {
  actionType: ActionTypes.PLACE_TILE,
  actionData: {
    tile: { id: 'A', rotation: 0, sides: {} as never },
    rowIndex: 15,
    tileIndex: 15,
  },
}

describe('buildScoreBreakdown', () => {
  it('разносит очки по видам объектов', () => {
    const history: GameAction[] = [
      addingScores(ObjectTypes.CITY, { '1': 12 }),
      addingScores(ObjectTypes.ROAD, { '1': 4 }),
      addingScores(ObjectTypes.MONASTERY, { '1': 9 }),
      addingScores(ObjectTypes.GARDEN, { '1': 2 }),
    ]

    expect(buildScoreBreakdown(history, 1)).toEqual({
      cities: 12,
      roads: 4,
      monasteries: 9,
      gardens: 2,
      other: 0,
    })
  })

  it('учитывает очки только своего игрока', () => {
    const history: GameAction[] = [
      addingScores(ObjectTypes.CITY, { '1': 12, '2': 6 }),
    ]

    expect(buildScoreBreakdown(history, 2)).toEqual({
      cities: 6,
      roads: 0,
      monasteries: 0,
      gardens: 0,
      other: 0,
    })
  })

  it('пропускает действия, не связанные с начислением очков', () => {
    expect(buildScoreBreakdown([placeTile], 1)).toEqual({
      cities: 0,
      roads: 0,
      monasteries: 0,
      gardens: 0,
      other: 0,
    })
  })

  it('для пустой истории даёт нули', () => {
    expect(buildScoreBreakdown([], 1).cities).toBe(0)
    expect(buildScoreBreakdown(undefined, 1).cities).toBe(0)
  })
})

describe('buildGameResults', () => {
  it('сортирует игроков по очкам и проставляет места', () => {
    const results = buildGameResults(
      [player(1, 'Иван'), player(2, 'Мария'), player(3, 'Пётр')],
      { '1': 10, '2': 30, '3': 20 }
    )

    expect(results.map((result) => result.name)).toEqual([
      'Мария',
      'Пётр',
      'Иван',
    ])
    expect(results.map((result) => result.place)).toEqual([1, 2, 3])
  })

  it('при равном счёте игроки делят место', () => {
    const results = buildGameResults(
      [player(1, 'Иван'), player(2, 'Мария'), player(3, 'Пётр')],
      { '1': 30, '2': 30, '3': 10 }
    )

    expect(results.map((result) => result.place)).toEqual([1, 1, 3])
  })

  it('отмечает победителя по списку сервера', () => {
    const results = buildGameResults(
      [player(1, 'Иван'), player(2, 'Мария')],
      { '1': 10, '2': 30 },
      [],
      [2]
    )

    expect(results[0].isWinner).toBe(true)
    expect(results[1].isWinner).toBe(false)
  })

  it('собирает разбивку очков по видам объектов', () => {
    const history: GameAction[] = [
      addingScores(ObjectTypes.CITY, { '1': 12 }),
      addingScores(ObjectTypes.ROAD, { '1': 4 }),
    ]

    const results = buildGameResults([player(1, 'Иван')], { '1': 20 }, history)

    expect(results[0].breakdown).toEqual({
      cities: 12,
      roads: 4,
      monasteries: 0,
      gardens: 0,
      other: 4,
    })
  })

  it('очки без истории попадают в «прочие начисления»', () => {
    const results = buildGameResults([player(1, 'Иван')], { '1': 15 })

    expect(results[0].breakdown.other).toBe(15)
  })

  it('для игрока без очков даёт нули', () => {
    const results = buildGameResults([player(1, 'Иван')], undefined)

    expect(results[0].total).toBe(0)
    expect(results[0].breakdown.other).toBe(0)
  })
})
