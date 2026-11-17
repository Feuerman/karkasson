import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GamePlacement } from '@server/modules/userStats'

const fsMock = {
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}

vi.mock('node:fs', () => fsMock)

async function loadUserStats() {
  vi.resetModules()
  const mod = await import('@server/modules/userStats')
  return mod
}

beforeEach(() => {
  vi.useFakeTimers()
  fsMock.existsSync.mockReturnValue(false)
  fsMock.readFileSync.mockReturnValue('')
  fsMock.writeFileSync.mockClear()
  fsMock.mkdirSync.mockClear()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('userStats', () => {
  it('считает победу и поражение', async () => {
    const { recordGameResults, getUserStats } = await loadUserStats()
    recordGameResults([
      { userId: 'u1', score: 100, place: 1 },
      { userId: 'u2', score: 60, place: 2 },
    ] as GamePlacement[])
    expect(getUserStats('u1')).toMatchObject({
      gamesPlayed: 1,
      wins: 1,
      losses: 0,
      totalScore: 100,
    })
    expect(getUserStats('u2')).toMatchObject({
      gamesPlayed: 1,
      wins: 0,
      losses: 1,
      totalScore: 60,
    })
  })

  it('накопительно обновляет статистику одного пользователя', async () => {
    const { recordGameResults, getUserStats } = await loadUserStats()
    recordGameResults([
      { userId: 'u3', score: 10, place: 1 },
    ] as GamePlacement[])
    recordGameResults([
      { userId: 'u3', score: 20, place: 2 },
    ] as GamePlacement[])
    expect(getUserStats('u3')).toMatchObject({
      gamesPlayed: 2,
      wins: 1,
      losses: 1,
      totalScore: 30,
    })
  })

  it('getUserStats возвращает пустую статистику без игр', async () => {
    const { getUserStats } = await loadUserStats()
    expect(getUserStats('unknown')).toMatchObject({
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      totalScore: 0,
      lastGameAt: 0,
    })
  })

  it('лидерборд сортирует по победам, очкам, играм и обрезает limit', async () => {
    const { recordGameResults, getLeaderboard } = await loadUserStats()
    recordGameResults([
      { userId: 'u4', score: 10, place: 1 },
    ] as GamePlacement[])
    recordGameResults([
      { userId: 'u4', score: 10, place: 1 },
    ] as GamePlacement[])
    recordGameResults([
      { userId: 'u5', score: 100, place: 1 },
    ] as GamePlacement[])
    recordGameResults([
      { userId: 'u6', score: 50, place: 2 },
    ] as GamePlacement[])
    const board = getLeaderboard(2)
    expect(board.map((p) => p.userId)).toEqual(['u4', 'u5'])
  })

  it('сохраняет статистику в файл при форсированном сохранении', async () => {
    const { recordGameResults, saveStatsNow } = await loadUserStats()
    recordGameResults([{ userId: 'u7', score: 5, place: 1 }] as GamePlacement[])
    saveStatsNow()
    expect(fsMock.writeFileSync).toHaveBeenCalled()
    expect(fsMock.mkdirSync).toHaveBeenCalled()
  })

  it('сохраняет статистику в файл по истечении таймера', async () => {
    const { recordGameResults } = await loadUserStats()
    recordGameResults([{ userId: 'u8', score: 5, place: 1 }] as GamePlacement[])
    vi.advanceTimersByTime(2_000)
    expect(fsMock.writeFileSync).toHaveBeenCalled()
  })

  it('загружает статистику из существующего файла при импорте', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue(
      JSON.stringify({
        userStats: {
          u9: {
            gamesPlayed: 2,
            wins: 1,
            losses: 1,
            totalScore: 50,
            lastGameAt: 123,
          },
        },
      })
    )
    const { getUserStats } = await loadUserStats()
    expect(getUserStats('u9')).toMatchObject({
      gamesPlayed: 2,
      wins: 1,
      losses: 1,
      totalScore: 50,
      lastGameAt: 123,
    })
  })

  it('начинает с пустой статистики при повреждённом файле', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue('{broken')
    const { getUserStats } = await loadUserStats()
    expect(getUserStats('u9')).toMatchObject({
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      totalScore: 0,
      lastGameAt: 0,
    })
  })

  it('начинает с пустой статистики, если userStats в файле не объект', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue(
      JSON.stringify({ userStats: [1, 2, 3] })
    )
    const { getUserStats } = await loadUserStats()
    expect(getUserStats('u9')).toMatchObject({
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      totalScore: 0,
      lastGameAt: 0,
    })
  })

  it('логирует ошибку записи в файл', async () => {
    const { recordGameResults, saveStatsNow } = await loadUserStats()
    fsMock.writeFileSync.mockImplementation(() => {
      throw new Error('disk full')
    })
    recordGameResults([
      { userId: 'u10', score: 5, place: 1 },
    ] as GamePlacement[])
    expect(() => saveStatsNow()).not.toThrow()
  })
})
