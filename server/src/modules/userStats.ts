/**
 * Статистика игр по авторизованным пользователям (Firebase Auth).
 *
 * Хранит в памяти и дублирует в файл, чтобы статистика переживала
 * перезапуск сервера. Каждая завершённая партия обновляет счётчик игр,
 * побед/поражений и суммарный счёт для каждого игрока с userId.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createLogger } from '../utils/logger'
import { isRecord } from '../utils/common'

const logger = createLogger('userStats')

const STATS_FILE = resolve(process.env.USER_STATS_FILE ?? 'data/userStats.json')

interface UserStatsRecord {
  gamesPlayed: number
  wins: number
  losses: number
  totalScore: number
  lastGameAt: number
}

interface StatsSnapshot {
  /** userId → статистика. */
  userStats: Record<string, UserStatsRecord>
}

function readSnapshot(): StatsSnapshot {
  try {
    if (!existsSync(STATS_FILE)) return { userStats: {} }
    const raw = readFileSync(STATS_FILE, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { userStats: {} }
    const record = parsed
    const userStats = record.userStats
    if (!isRecord(userStats)) {
      return { userStats: {} }
    }
    return { userStats: userStats as Record<string, UserStatsRecord> }
  } catch (error: unknown) {
    logger.error(
      'Не удалось прочитать файл статистики пользователей, начинаем с пустого:',
      error
    )
    return { userStats: {} }
  }
}

function writeSnapshot(snapshot: StatsSnapshot): void {
  try {
    const dir = dirname(STATS_FILE)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(STATS_FILE, JSON.stringify(snapshot, null, 2), 'utf8')
  } catch (error: unknown) {
    logger.error('Не удалось сохранить статистику пользователей:', error)
  }
}

/** userId → статистика. */
const userStats = new Map<string, UserStatsRecord>()

let saveTimer: NodeJS.Timeout | null = null
let dirty = false

function scheduleSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  dirty = true
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (dirty) {
      dirty = false
      flush()
    }
  }, 2_000)
  saveTimer.unref?.()
}

function flush(): void {
  const snapshot: StatsSnapshot = {
    userStats: Object.fromEntries(userStats.entries()),
  }
  writeSnapshot(snapshot)
}

/** Загружает статистику из файла при первом импорте модуля. */
const snapshot = readSnapshot()
for (const [userId, stats] of Object.entries(snapshot.userStats)) {
  userStats.set(userId, stats)
}

/** Итоговое место игрока в партии. */
export type GamePlacement = { userId: string; score: number; place: number }

/**
 * Регистрирует завершённую партию для статистики пользователей.
 * `placements` — список игроков с userId, их очками и местами.
 */
export function recordGameResults(placements: GamePlacement[]): void {
  for (const { userId, score, place } of placements) {
    const current = userStats.get(userId) ?? {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      totalScore: 0,
      lastGameAt: 0,
    }
    current.gamesPlayed += 1
    current.totalScore += score
    current.lastGameAt = Date.now()
    // Место 1 — победа, остальное — поражение.
    if (place === 1) {
      current.wins += 1
    } else {
      current.losses += 1
    }
    userStats.set(userId, current)
  }
  scheduleSave()
}

/** Возвращает статистику пользователя, или пустую если игр не было. */
export function getUserStats(userId: string): UserStatsRecord {
  return (
    userStats.get(userId) ?? {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      totalScore: 0,
      lastGameAt: 0,
    }
  )
}

/** Топ пользователей по количеству побед, затем по очкам. */
export function getLeaderboard(
  limit = 10
): Array<{ userId: string } & UserStatsRecord> {
  return [...userStats.entries()]
    .map(([userId, stats]) => ({ userId, ...stats }))
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.totalScore - a.totalScore ||
        b.gamesPlayed - a.gamesPlayed
    )
    .slice(0, limit)
}

/** Принудительно сохраняет статистику в файл. */
export function saveStatsNow(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (dirty) {
    dirty = false
    flush()
  }
}
