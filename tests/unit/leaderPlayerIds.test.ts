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
  it('возвращает игрока с максимальным счётом', () => {
    expect(
      leaderPlayerIds(
        scores([
          [1, 5],
          [2, 12],
          [3, 7],
        ])
      )
    ).toEqual(['2'])
  })

  it('возвращает всех при равном максимальном счёте', () => {
    expect(
      leaderPlayerIds(
        scores([
          [1, 9],
          [2, 9],
          [3, 4],
        ])
      )
    ).toEqual(['1', '2'])
  })

  it('считает лидером игрока с нулём, если очки не набрал никто', () => {
    expect(
      leaderPlayerIds(
        scores([
          [1, 0],
          [2, 0],
        ])
      )
    ).toEqual(['1', '2'])
  })

  it('не полагается на порядок ключей', () => {
    expect(
      leaderPlayerIds(
        scores([
          [7, 3],
          [2, 21],
        ])
      )
    ).toEqual(['2'])
  })

  it('сохраняет идентификаторы в исходном виде при строковых id', () => {
    expect(
      leaderPlayerIds(
        scores([
          ['1', 4],
          ['2', 8],
        ])
      )
    ).toEqual(['2'])
  })

  it('возвращает пустой список для пустого счёта', () => {
    expect(leaderPlayerIds({} as Scores)).toEqual([])
  })
})
