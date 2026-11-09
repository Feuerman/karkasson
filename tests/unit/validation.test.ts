import { describe, expect, it, vi } from 'vitest'
import {
  parseAddPlayer,
  parseCityRequest,
  parseCreateGame,
  parseGameRequest,
  parsePlaceFollower,
  parsePlaceTile,
  parsePointRequest,
  parsePositionRequest,
  parseRegisterSession,
  parseRemovePlayer,
  parseSelectPlacingPoint,
  parseUpdateCurrentTile,
  payloadAndCallback,
} from '@server/socket/validation'
import { MAX_SESSION_TOKEN_LENGTH } from '@server/services/sessionToken'

const gameId = '00000000-0000-4000-8000-000000000000'
const position = { rowIndex: 15, tileIndex: 16 }
const point = {
  x: 15,
  y: 16,
  direction: 'north',
  pointType: 'city',
  regionIndex: 0,
  rowIndex: 15,
  tileIndex: 16,
  precisionX: 1.5,
  precisionY: 2.5,
} as const
const place = {
  point,
  temporaryObject: { id: 'city-1' },
}

describe('Разбор payload сокета', () => {
  it('извлекает payload и callback из разных форм аргументов', () => {
    const callback = vi.fn()

    expect(payloadAndCallback(callback, undefined)).toEqual({
      payload: undefined,
      callback,
    })
    expect(payloadAndCallback({ gameId }, callback)).toEqual({
      payload: { gameId },
      callback,
    })
    expect(payloadAndCallback({ gameId }, undefined)).toEqual({
      payload: { gameId },
      callback: undefined,
    })
  })

  it('регистрация сессии принимает отсутствие токена и ограничивает длину', () => {
    expect(parseRegisterSession(undefined)).toEqual({})
    expect(parseRegisterSession(null)).toEqual({})
    expect(parseRegisterSession({})).toEqual({})
    expect(parseRegisterSession({ token: 'abc' })).toEqual({ token: 'abc' })
    expect(parseRegisterSession({ token: null })).toEqual({})
    expect(parseRegisterSession({ token: 42 })).toBeUndefined()
    expect(parseRegisterSession({ token: '' })).toBeUndefined()
    expect(
      parseRegisterSession({ token: 'a'.repeat(MAX_SESSION_TOKEN_LENGTH + 1) })
    ).toBeUndefined()
    expect(parseRegisterSession({ token: 'a\nb' })).toBeUndefined()
    expect(parseRegisterSession('token')).toBeUndefined()
  })

  it('создание лобби разбирает опции и отвергает небулевы значения', () => {
    expect(parseCreateGame(undefined)).toEqual({ options: {} })
    expect(parseCreateGame(null)).toEqual({ options: {} })
    expect(
      parseCreateGame({ riverEnabled: true, finalScoringEnabled: false })
    ).toEqual({ options: { riverEnabled: true, finalScoringEnabled: false } })
    expect(parseCreateGame({ riverEnabled: 'yes' })).toEqual({
      options: {},
      invalidOption: 'riverEnabled',
    })
    expect(parseCreateGame('options')).toBeUndefined()
  })

  it('создание лобби принимает пароль и признак приватной комнаты', () => {
    expect(parseCreateGame({ password: 'секрет', isPrivate: true })).toEqual({
      options: { password: 'секрет', isPrivate: true },
    })
    expect(parseCreateGame({ isPrivate: false })).toEqual({
      options: { isPrivate: false },
    })
    // Пустой пароль — как отсутствие пароля.
    expect(parseCreateGame({ password: '' })).toEqual({ options: {} })
    // Слишком длинный пароль игнорируется.
    expect(parseCreateGame({ password: 'a'.repeat(65) })).toEqual({
      options: {},
    })
    // Пароль с управляющими символами игнорируется.
    expect(parseCreateGame({ password: 'a\u0000b' })).toEqual({
      options: {},
    })
    // Небулев isPrivate игнорируется.
    expect(parseCreateGame({ isPrivate: 'yes' })).toEqual({ options: {} })
  })

  it('общий запрос игры проверяет идентификатор', () => {
    expect(parseGameRequest({ gameId })).toEqual({ gameId })
    expect(parseGameRequest({ gameId: `  ${gameId}  ` })).toEqual({ gameId })
    expect(parseGameRequest({ gameId: 'x'.repeat(65) })).toBeUndefined()
    expect(parseGameRequest({ gameId: 'a\u0000' })).toBeUndefined()
    expect(parseGameRequest({})).toBeUndefined()
    expect(parseGameRequest(null)).toBeUndefined()
  })

  it('запрос игры принимает опциональный пароль приватной комнаты', () => {
    expect(parseGameRequest({ gameId, password: 'sekret' })).toEqual({
      gameId,
      password: 'sekret',
    })
    expect(parseGameRequest({ gameId })).toEqual({ gameId })
    // Пустой пароль — как отсутствие пароля.
    expect(parseGameRequest({ gameId, password: '' })).toEqual({ gameId })
    // Нестроковый пароль игнорируется.
    expect(parseGameRequest({ gameId, password: 42 })).toEqual({ gameId })
    // Слишком длинный пароль игнорируется.
    expect(parseGameRequest({ gameId, password: 'a'.repeat(65) })).toEqual({
      gameId,
    })
  })

  it('добавление игрока проверяет слот и имя', () => {
    expect(parseAddPlayer({ gameId, index: 0, name: null })).toEqual({
      gameId,
      index: 0,
      name: null,
    })
    expect(parseAddPlayer({ gameId, index: 5, name: 'Alice' })).toEqual({
      gameId,
      index: 5,
      name: 'Alice',
    })
    expect(parseAddPlayer({ gameId, index: 6, name: 'Alice' })).toBeUndefined()
    expect(parseAddPlayer({ gameId, index: -1, name: 'Alice' })).toBeUndefined()
    expect(
      parseAddPlayer({ gameId, index: 1.5, name: 'Alice' })
    ).toBeUndefined()
    expect(parseAddPlayer({ gameId, index: 1, name: 42 })).toBeUndefined()
  })

  it('удаление игрока требует булев флаг', () => {
    expect(
      parseRemovePlayer({ gameId, index: 2, keepAsComputer: true })
    ).toEqual({ gameId, index: 2, keepAsComputer: true })
    expect(
      parseRemovePlayer({ gameId, index: 2, keepAsComputer: false })
    ).toEqual({ gameId, index: 2, keepAsComputer: false })
    expect(parseRemovePlayer({ gameId, index: 2 })).toBeUndefined()
    expect(
      parseRemovePlayer({ gameId, index: 2, keepAsComputer: 'yes' })
    ).toBeUndefined()
  })

  it('позиции на доске ограничены сеткой', () => {
    expect(parsePositionRequest({ gameId, position })).toEqual({
      gameId,
      position,
    })
    expect(parseSelectPlacingPoint({ gameId, point: position })).toEqual({
      gameId,
      position,
    })
    expect(
      parsePositionRequest({
        gameId,
        position: { rowIndex: 30, tileIndex: 0 },
      })
    ).toBeUndefined()
    expect(
      parsePositionRequest({
        gameId,
        position: { rowIndex: -1, tileIndex: 0 },
      })
    ).toBeUndefined()
    expect(
      parseSelectPlacingPoint({
        gameId,
        point: { rowIndex: 1.1, tileIndex: 2 },
      })
    ).toBeUndefined()
  })

  it('поворот принимается только из допустимых углов', () => {
    expect(parseUpdateCurrentTile({ gameId, rotation: 90 })).toEqual({
      gameId,
      rotation: 90,
    })
    expect(parseUpdateCurrentTile({ gameId, tile: { rotation: 270 } })).toEqual(
      { gameId, rotation: 270 }
    )
    expect(parseUpdateCurrentTile({ gameId })).toEqual({ gameId })
    expect(parseUpdateCurrentTile({ gameId, rotation: 45 })).toEqual({
      gameId,
      invalidRotation: true,
    })
    expect(parseUpdateCurrentTile({ gameId, tile: 'tile' })).toEqual({
      gameId,
      invalidRotation: true,
    })
    expect(parseUpdateCurrentTile(null)).toBeUndefined()
    expect(parsePlaceTile({ gameId, position, rotation: 180 })).toEqual({
      gameId,
      position,
      rotation: 180,
    })
    expect(parsePlaceTile({ gameId, rotation: 180 })).toBeUndefined()
  })

  it('место подданного и точка разбираются по полям', () => {
    expect(
      parsePlaceFollower({ gameId, place, followerType: 'abbot' })
    ).toEqual({ gameId, place, followerType: 'abbot' })
    expect(parsePlaceFollower({ gameId, place })).toEqual({
      gameId,
      place,
      followerType: 'follower',
    })
    expect(
      parsePlaceFollower({ gameId, place, followerType: 'king' })
    ).toBeUndefined()
    expect(
      parsePlaceFollower({
        gameId,
        place: { point: { x: 0 }, temporaryObject: { id: 'x' } },
      })
    ).toBeUndefined()
    expect(
      parsePlaceFollower({
        gameId,
        place: { point, temporaryObject: {} },
      })
    ).toBeUndefined()
    expect(parsePointRequest({ gameId, point })).toEqual({ gameId, point })
    expect(
      parsePointRequest({ gameId, point: { ...point, direction: 'up' } })
    ).toBeUndefined()
    expect(
      parsePointRequest({ gameId, point: { ...point, pointType: 'water' } })
    ).toBeUndefined()
    expect(
      parsePointRequest({ gameId, point: { ...point, regionIndex: 100 } })
    ).toBeUndefined()
    expect(
      parsePointRequest({ gameId, point: { ...point, precisionX: Infinity } })
    ).toBeUndefined()
    expect(parseCityRequest({ gameId, cityId: 'city-1', point })).toEqual({
      gameId,
      cityId: 'city-1',
      point,
    })
    expect(parseCityRequest({ gameId, point })).toBeUndefined()
  })
})
