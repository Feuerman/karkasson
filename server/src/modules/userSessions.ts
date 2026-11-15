/**
 * Привязка сессий к пользователям (Firebase Auth).
 *
 * Хранит в памяти соответствие userId → множество активных sessionId и
 * дублирует его в файл, чтобы привязки переживали перезапуск сервера.
 * При реконнекте сокета привязка userId ↔ sessionId восстанавливается из
 * этого хранилища, поэтому игрок не теряет доступ к своим партиям.
 *
 * Реализовано без внешней зависимости: Firebase Auth на клиенте выдаёт
 * ID token с userId, сервер верифицирует его через Admin SDK и связывает
 * с сессией.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createLogger } from '../utils/logger'

const logger = createLogger('userSessions')

const MAX_USER_SESSIONS = 5

const SESSIONS_FILE = resolve(
  process.env.USER_SESSIONS_FILE ?? 'data/userSessions.json'
)

interface SessionsSnapshot {
  /** userId → массив sessionId. */
  userToSessions: Record<string, string[]>
  /** userId → профиль пользователя (из Firebase ID token). */
  userProfiles: Record<
    string,
    { displayName: string | null; photoURL: string | null }
  >
}

function readSnapshot(): SessionsSnapshot {
  try {
    if (!existsSync(SESSIONS_FILE))
      return { userToSessions: {}, userProfiles: {} }
    const raw = readFileSync(SESSIONS_FILE, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object')
      return { userToSessions: {}, userProfiles: {} }
    const record = parsed as Record<string, unknown>
    const userToSessions = record.userToSessions
    if (
      !userToSessions ||
      typeof userToSessions !== 'object' ||
      Array.isArray(userToSessions)
    ) {
      return { userToSessions: {}, userProfiles: {} }
    }
    const userProfiles = record.userProfiles
    if (
      !userProfiles ||
      typeof userProfiles !== 'object' ||
      Array.isArray(userProfiles)
    ) {
      return {
        userToSessions: userToSessions as Record<string, string[]>,
        userProfiles: {},
      }
    }
    return {
      userToSessions: userToSessions as Record<string, string[]>,
      userProfiles: userProfiles as Record<
        string,
        { displayName: string | null; photoURL: string | null }
      >,
    }
  } catch (error: unknown) {
    logger.error(
      'Не удалось прочитать файл привязок сессий, начинаем с пустого:',
      error
    )
    return { userToSessions: {}, userProfiles: {} }
  }
}

function writeSnapshot(snapshot: SessionsSnapshot): void {
  try {
    const dir = dirname(SESSIONS_FILE)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(SESSIONS_FILE, JSON.stringify(snapshot, null, 2), 'utf8')
  } catch (error: unknown) {
    logger.error('Не удалось сохранить привязки сессий:', error)
  }
}

/** userId → множество sessionId, привязанных к этому пользователю. */
const userToSessions = new Map<string, Set<string>>()

/** sessionId → userId для быстрого обратного поиска. */
const sessionToUser = new Map<string, string>()

/** userId → профиль пользователя (из Firebase ID token). */
const userProfiles = new Map<
  string,
  { displayName: string | null; photoURL: string | null }
>()

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
  const snapshot: SessionsSnapshot = {
    userToSessions: Object.fromEntries(
      [...userToSessions.entries()].map(([userId, sessions]) => [
        userId,
        [...sessions],
      ])
    ),
    userProfiles: Object.fromEntries(userProfiles.entries()),
  }
  writeSnapshot(snapshot)
}

/** Загружает привязки из файла при первом импорте модуля. */
const snapshot = readSnapshot()
for (const [userId, sessions] of Object.entries(snapshot.userToSessions)) {
  const set = new Set(sessions)
  userToSessions.set(userId, set)
  for (const sessionId of set) {
    sessionToUser.set(sessionId, userId)
  }
}
for (const [userId, profile] of Object.entries(snapshot.userProfiles)) {
  userProfiles.set(userId, profile)
}

/** Добавляет сессию в привязки пользователя. Возвращает false при превышении лимита. */
export function addUserSession(userId: string, sessionId: string): boolean {
  let sessions = userToSessions.get(userId)
  if (!sessions) {
    sessions = new Set()
    userToSessions.set(userId, sessions)
  }
  if (sessions.size >= MAX_USER_SESSIONS && !sessions.has(sessionId)) {
    return false
  }
  sessions.add(sessionId)
  sessionToUser.set(sessionId, userId)
  scheduleSave()
  return true
}

/** Удаляет сессию из привязок пользователя. */
export function removeUserSession(sessionId: string): void {
  const userId = sessionToUser.get(sessionId)
  if (!userId) return
  sessionToUser.delete(sessionId)
  const sessions = userToSessions.get(userId)
  if (sessions) {
    sessions.delete(sessionId)
    if (sessions.size === 0) userToSessions.delete(userId)
  }
  scheduleSave()
}

/** Возвращает все sessionId пользователя. */
export function getUserSessions(userId: string): string[] {
  return [...(userToSessions.get(userId) ?? [])]
}

/** Возвращает userId по sessionId, или null если сессия не привязана. */
export function getSessionUserId(sessionId: string): string | null {
  return sessionToUser.get(sessionId) ?? null
}

/** Удаляет все привязки пользователя (выход из аккаунта). */
export function clearUserSessions(userId: string): void {
  const sessions = userToSessions.get(userId)
  if (!sessions) return
  for (const sessionId of sessions) {
    sessionToUser.delete(sessionId)
  }
  userToSessions.delete(userId)
  scheduleSave()
}

/** Сохраняет/обновляет профиль пользователя (из Firebase ID token). */
export function setUserProfile(
  userId: string,
  profile: { displayName: string | null; photoURL: string | null }
): void {
  userProfiles.set(userId, profile)
  scheduleSave()
}

/** Возвращает профиль пользователя, или null если не сохранён. */
export function getUserProfile(
  userId: string
): { displayName: string | null; photoURL: string | null } | null {
  return userProfiles.get(userId) ?? null
}

/** Число привязанных сессий пользователя. */
export function userSessionCount(userId: string): number {
  return userToSessions.get(userId)?.size ?? 0
}

/** Принудительно сохраняет привязки в файл (например, при остановке сервера). */
export function saveSessionsNow(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (dirty) {
    dirty = false
    flush()
  }
}
