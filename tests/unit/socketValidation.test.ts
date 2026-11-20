import { describe, expect, it } from 'vitest'
import {
  parseJoinGame,
  parseSpectatorRequest,
  parseLinkAccount,
  parseLogout,
  parseRestoreAccount,
} from '@server/socket/validation'

describe('parseJoinGame', () => {
  it.each([
    [{ gameId: 'game-1' }, { gameId: 'game-1' }],
    [
      { gameId: 'game-1', commandId: 'cmd-1' },
      { gameId: 'game-1', commandId: 'cmd-1' },
    ],
  ])('разбирает корректный запрос %j', (value, expected) => {
    expect(parseJoinGame(value)).toEqual(expected)
  })

  it.each([
    undefined,
    null,
    'string',
    42,
    {},
    { gameId: '' },
    { gameId: 'a'.repeat(65) },
    { gameId: 'game-1', commandId: 'a'.repeat(129) },
  ])('возвращает undefined для %j', (value) => {
    expect(parseJoinGame(value)).toBeUndefined()
  })
})

describe('parseSpectatorRequest', () => {
  it.each([
    [{ gameId: 'game-1' }, { gameId: 'game-1' }],
    [
      { gameId: 'game-1', commandId: 'cmd-1' },
      { gameId: 'game-1', commandId: 'cmd-1' },
    ],
  ])('разбирает корректный запрос %j', (value, expected) => {
    expect(parseSpectatorRequest(value)).toEqual(expected)
  })

  it.each([undefined, null, 'string', {}, { gameId: '' }])(
    'возвращает undefined для %j',
    (value) => {
      expect(parseSpectatorRequest(value)).toBeUndefined()
    }
  )
})

describe('parseLinkAccount', () => {
  it('разбирает корректный запрос', () => {
    expect(parseLinkAccount({ userId: 'user-1', idToken: 'token-1' })).toEqual({
      userId: 'user-1',
      idToken: 'token-1',
    })
  })

  it.each([undefined, null, 'string', 42, {}, { userId: '' }, { idToken: '' }])(
    'возвращает undefined для %j',
    (value) => {
      expect(parseLinkAccount(value)).toBeUndefined()
    }
  )
})

describe('parseLogout', () => {
  it.each([undefined, null, {}])('возвращает пустой объект для %j', (value) => {
    expect(parseLogout(value)).toEqual({})
  })

  it.each(['string', 42, []])('возвращает undefined для %j', (value) => {
    expect(parseLogout(value)).toBeUndefined()
  })
})

describe('parseRestoreAccount', () => {
  it('разбирает корректный запрос', () => {
    expect(parseRestoreAccount({ userId: 'user-1' })).toEqual({
      userId: 'user-1',
    })
  })

  it.each([undefined, null, 'string', {}, { userId: '' }])(
    'возвращает undefined для %j',
    (value) => {
      expect(parseRestoreAccount(value)).toBeUndefined()
    }
  )
})
