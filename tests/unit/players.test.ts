import { describe, expect, it } from 'vitest'
import type { PlayerView, Scores } from '@server/modules/types'
import {
  findOwnPlayer,
  getNextPlayer,
  isComputerPlayer,
  rankPlayers,
} from '@/utils/players'

/**
 * Таблица счёта в панели партии: игроки по убыванию очков, лидер помечен,
 * а игрок, за которым сидит браузер, отмечен как «вы». Порядок ходов и
 * признак компьютера берутся из тех же данных, что и на сервере.
 */

const player = (
  id: number,
  name: string,
  overrides: Partial<PlayerView> = {}
): PlayerView => ({
  id,
  name,
  color: 'coral',
  score: 0,
  sessionId: `session-${id}`,
  isConnected: true,
  ...overrides,
})

const scores = (entries: [number, number][]): Scores =>
  Object.fromEntries(entries) as Scores

describe('isComputerPlayer', () => {
  it('компьютером считается игрок без сокета и устройства', () => {
    expect(
      isComputerPlayer(player(1, 'ИИ', { sessionId: null, isConnected: false }))
    ).toBe(true)
  })

  it('подключённый игрок не компьютер', () => {
    expect(isComputerPlayer(player(1, 'Иван'))).toBe(false)
  })

  it('отключившийся игрок не компьютер: у него есть устройство', () => {
    expect(isComputerPlayer(player(1, 'Иван', { isConnected: false }))).toBe(
      false
    )
  })

  it('для отсутствующего игрока даёт ложь', () => {
    expect(isComputerPlayer(null)).toBe(false)
  })
})

describe('findOwnPlayer', () => {
  const players = [player(1, 'Иван'), player(2, 'Мария')]

  it('находит игрока по идентификатору сессии', () => {
    expect(findOwnPlayer(players, { sessionId: 'session-2' })?.name).toBe(
      'Мария'
    )
  })

  it('для чужой сессии не находит игрока', () => {
    expect(findOwnPlayer(players, { sessionId: 'session-9' })).toBeUndefined()
  })

  it('пустая сессия не считается своей', () => {
    expect(findOwnPlayer(players, { sessionId: null })).toBeUndefined()
  })
})

describe('rankPlayers', () => {
  it('сортирует игроков по убыванию очков', () => {
    const ranked = rankPlayers(
      [player(1, 'Иван'), player(2, 'Мария'), player(3, 'Пётр')],
      scores([
        [1, 3],
        [2, 9],
        [3, 5],
      ])
    )

    expect(ranked.map((entry) => entry.player.name)).toEqual([
      'Мария',
      'Пётр',
      'Иван',
    ])
  })

  it('при равном счёте сохраняет прежний порядок', () => {
    const ranked = rankPlayers(
      [player(1, 'Иван'), player(2, 'Мария')],
      scores([
        [1, 4],
        [2, 4],
      ])
    )

    expect(ranked.map((entry) => entry.player.name)).toEqual(['Иван', 'Мария'])
  })

  it('помечает лидера и игрока текущего браузера', () => {
    const ranked = rankPlayers(
      [player(1, 'Иван'), player(2, 'Мария')],
      scores([
        [1, 3],
        [2, 9],
      ]),
      1
    )

    expect(ranked[0].isLeader).toBe(true)
    expect(ranked[0].isMe).toBe(false)
    expect(ranked[1].isMe).toBe(true)
  })

  it('при нулевом счёте лидера нет', () => {
    const ranked = rankPlayers([player(1, 'Иван')], scores([[1, 0]]))

    expect(ranked[0].isLeader).toBe(false)
  })

  it('без счёта даёт нули', () => {
    const ranked = rankPlayers([player(1, 'Иван')], undefined)

    expect(ranked[0].score).toBe(0)
  })
})

describe('getNextPlayer', () => {
  const players = [player(1, 'Иван'), player(2, 'Мария'), player(3, 'Пётр')]

  it('следующий игрок идёт по кругу', () => {
    expect(getNextPlayer(players, 0)?.name).toBe('Мария')
    expect(getNextPlayer(players, 2)?.name).toBe('Иван')
  })

  it('для пустого списка игроков не находит следующего', () => {
    expect(getNextPlayer([], 0)).toBeUndefined()
  })
})
