import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fsMock = {
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}

vi.mock('node:fs', () => fsMock)

async function loadUserSessions() {
  vi.resetModules()
  const mod = await import('@server/modules/userSessions')
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

describe('userSessions', () => {
  it('добавляет сессию пользователя и находит её в обе стороны', async () => {
    const { addUserSession, getUserSessions, getSessionUserId } =
      await loadUserSessions()
    expect(addUserSession('u1', 's1')).toBe(true)
    expect(getUserSessions('u1')).toEqual(['s1'])
    expect(getSessionUserId('s1')).toBe('u1')
  })

  it('не добавляет сессию сверх лимита MAX_USER_SESSIONS', async () => {
    const { addUserSession } = await loadUserSessions()
    for (let i = 1; i <= 5; i++) {
      expect(addUserSession('u1', `s${i}`)).toBe(true)
    }
    expect(addUserSession('u1', 's6')).toBe(false)
  })

  it('повторное добавление той же сессии не считается новым', async () => {
    const { addUserSession, userSessionCount } = await loadUserSessions()
    expect(addUserSession('u1', 's1')).toBe(true)
    expect(addUserSession('u1', 's1')).toBe(true)
    expect(userSessionCount('u1')).toBe(1)
  })

  it('удаляет сессию и обратную привязку', async () => {
    const {
      addUserSession,
      removeUserSession,
      getUserSessions,
      getSessionUserId,
    } = await loadUserSessions()
    addUserSession('u1', 's1')
    removeUserSession('s1')
    expect(getUserSessions('u1')).toEqual([])
    expect(getSessionUserId('s1')).toBe(null)
  })

  it('удаление неизвестной сессии не падает', async () => {
    const { removeUserSession } = await loadUserSessions()
    expect(() => removeUserSession('missing')).not.toThrow()
  })

  it('clearUserSessions удаляет все сессии пользователя', async () => {
    const { addUserSession, clearUserSessions, getUserSessions } =
      await loadUserSessions()
    addUserSession('u1', 's1')
    addUserSession('u1', 's2')
    clearUserSessions('u1')
    expect(getUserSessions('u1')).toEqual([])
  })

  it('setUserProfile и getUserProfile хранят профиль', async () => {
    const { setUserProfile, getUserProfile } = await loadUserSessions()
    setUserProfile('u1', { displayName: 'Alice', photoURL: 'http://a.png' })
    expect(getUserProfile('u1')).toEqual({
      displayName: 'Alice',
      photoURL: 'http://a.png',
    })
    expect(getUserProfile('nobody')).toBe(null)
  })

  it('userSessionCount возвращает число сессий', async () => {
    const { addUserSession, userSessionCount } = await loadUserSessions()
    addUserSession('u1', 's1')
    addUserSession('u1', 's2')
    expect(userSessionCount('u1')).toBe(2)
    expect(userSessionCount('u2')).toBe(0)
  })

  it('saveSessionsNow сбрасывает таймер и пишет в файл', async () => {
    const { addUserSession, saveSessionsNow } = await loadUserSessions()
    addUserSession('u1', 's1')
    saveSessionsNow()
    expect(fsMock.writeFileSync).toHaveBeenCalled()
    expect(fsMock.mkdirSync).toHaveBeenCalled()
  })

  it('пишет привязки в файл по истечении таймера', async () => {
    const { addUserSession } = await loadUserSessions()
    addUserSession('u1', 's1')
    vi.advanceTimersByTime(2_000)
    expect(fsMock.writeFileSync).toHaveBeenCalled()
  })

  it('загружает привязки из существующего файла при импорте', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue(
      JSON.stringify({
        userToSessions: { u1: ['s1', 's2'] },
        userProfiles: { u1: { displayName: 'Alice', photoURL: null } },
      })
    )
    const { getUserSessions, getSessionUserId, getUserProfile } =
      await loadUserSessions()
    expect(getUserSessions('u1')).toEqual(['s1', 's2'])
    expect(getSessionUserId('s1')).toBe('u1')
    expect(getUserProfile('u1')).toEqual({
      displayName: 'Alice',
      photoURL: null,
    })
  })

  it('начинает с пустых привязок при повреждённом файле', async () => {
    fsMock.existsSync.mockReturnValue(true)
    fsMock.readFileSync.mockReturnValue('{broken')
    const { getSessionUserId } = await loadUserSessions()
    expect(getSessionUserId('s1')).toBe(null)
  })

  it('логирует ошибку записи привязок в файл', async () => {
    const { addUserSession, saveSessionsNow } = await loadUserSessions()
    fsMock.writeFileSync.mockImplementation(() => {
      throw new Error('disk full')
    })
    addUserSession('u1', 's1')
    expect(() => saveSessionsNow()).not.toThrow()
  })
})
