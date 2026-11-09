/**
 * Привязка сессий к пользователям (Firebase Auth).
 *
 * Хранит в памяти соответствие userId → множество активных sessionId.
 * Живёт только в рамках одного инстанса сервера: при перезапуске привязки
 * теряются, но пользователь может войти снова и восстановить доступ к своим
 * партиям по сохранённым на сервере gameId (через RejoinGame).
 *
 * Реализовано без внешней зависимости: Firebase Auth на клиенте выдаёт
 * ID token с userId, сервер принимает userId и связывает его с текущей
 * сессией. Проверка подписи ID token (через Firebase Admin SDK) может быть
 * добавлена позже на этапе эксплуатации.
 */

const MAX_USER_SESSIONS = 5

/** userId → множество sessionId, привязанных к этому пользователю. */
const userToSessions = new Map<string, Set<string>>()

/** sessionId → userId для быстрого обратного поиска. */
const sessionToUser = new Map<string, string>()

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
}

/** Число привязанных сессий пользователя. */
export function userSessionCount(userId: string): number {
  return userToSessions.get(userId)?.size ?? 0
}
