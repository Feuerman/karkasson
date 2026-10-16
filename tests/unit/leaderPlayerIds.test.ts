import { describe, expect, it } from 'vitest'
import { leaderPlayerIds } from '@server/modules/scoring'
import type { PlayerId, Scores } from '@server/modules/types'

/**
 * Scores — это объект, поэтому ключи всегда строки, даже если PlayerId
 * объявлен как `string | number`. Идентификаторы лидеров возвращаются
 * именно в том виде, в каком они лежат в счёте.
 */
function scores(entries: [PlayerId, number][]): Scores {
  return Object.fromEntries(entries) as Scores
}

describe('Лидеры партии', () => {
  it.each([
    {
      case: 'максимальный счёт',
      entries: [
        [1, 5],
        [2, 12],
        [3, 7],
      ] as [PlayerId, number][],
      leaders: ['2'],
    },
    {
      case: 'равный максимальный счёт',
      entries: [
        [1, 9],
        [2, 9],
        [3, 4],
      ] as [PlayerId, number][],
      leaders: ['1', '2'],
    },
    {
      case: 'нулевой счёт у всех игроков',
      entries: [
        [1, 0],
        [2, 0],
      ] as [PlayerId, number][],
      leaders: ['1', '2'],
    },
    {
      case: 'максимум не зависит от порядка ключей',
      entries: [
        [7, 3],
        [2, 21],
      ] as [PlayerId, number][],
      leaders: ['2'],
    },
    {
      case: 'строковые id сохраняются',
      entries: [
        ['1', 4],
        ['2', 8],
      ] as [PlayerId, number][],
      leaders: ['2'],
    },
  ])('возвращает лидеров: $case', ({ entries, leaders }) => {
    expect(leaderPlayerIds(scores(entries))).toEqual(leaders)
  })

  it('возвращает пустой список для пустого счёта', () => {
    expect(leaderPlayerIds({} as Scores)).toEqual([])
  })
})
