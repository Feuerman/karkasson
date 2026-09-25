import { describe, expect, it } from 'vitest'
import { GameManager } from '../../server/src/modules/GameManager'
import {
  deserializeGameState,
  GAME_SAVE_SCHEMA_VERSION,
  serializeGameState,
} from '../../server/src/modules/gameSave'

describe('Схема сохранения игры', () => {
  it('сериализует игру с явной версией схемы', () => {
    const game = new GameManager({ players: [] })
    game.id = 'game-1'

    const saved = JSON.parse(serializeGameState(game)) as {
      schemaVersion: number
      state: { id: string }
    }

    expect(saved.schemaVersion).toBe(GAME_SAVE_SCHEMA_VERSION)
    expect(saved.state.id).toBe('game-1')
  })

  it('читает legacy-сохранение без envelope версии и добавляет gardens', () => {
    const game = new GameManager({ players: [] })
    game.id = 'legacy-game'
    const legacy = JSON.parse(JSON.stringify(game)) as Record<string, unknown>
    const temporaryObjects = legacy.temporaryObjects as Record<string, unknown>
    const completedObjects = legacy.completedObjects as Record<string, unknown>
    delete temporaryObjects.gardens
    delete completedObjects.gardens

    const restored = deserializeGameState(legacy)

    expect(restored.id).toBe('legacy-game')
    expect(restored.temporaryObjects.gardens).toEqual([])
    expect(restored.completedObjects.gardens).toEqual([])
  })

  it('восстанавливает legacy-лобби, сохранённое до появления полного состояния', () => {
    const player = {
      id: 1,
      name: 'Host',
      color: 'coral',
      score: 0,
      socketId: 'socket-host',
      deviceId: 'device-host',
    }

    const restored = deserializeGameState({
      id: 'legacy-lobby',
      players: [player],
    })

    expect(restored.id).toBe('legacy-lobby')
    expect(restored.gameIsStarted).toBe(false)
    expect(restored.players).toEqual([player])
    expect(restored.playersFollowers[1]).toEqual({
      ordinaryFollowers: 7,
      monks: 1,
    })
  })

  it('отклоняет неизвестную версию схемы', () => {
    expect(() =>
      deserializeGameState({ schemaVersion: 99, state: { id: 'future' } })
    ).toThrow('Unsupported game save schema version: 99')
  })

  it('отклоняет сохранение с повреждённым тайлом и пулом фишек', () => {
    const game = new GameManager({
      players: [
        {
          id: 1,
          name: 'Player',
          color: 'coral',
          score: 0,
          socketId: null,
          deviceId: null,
        },
      ],
    })
    game.id = 'invalid-state'
    const state = JSON.parse(JSON.stringify(game)) as Record<string, unknown>

    const brokenTile = JSON.parse(JSON.stringify(state.tilesList)) as Array<
      Record<string, unknown>
    >
    brokenTile[0].sides = { north: 'forest' }
    state.tilesList = brokenTile
    expect(() => deserializeGameState(state)).toThrow('invalid tile')

    const validState = JSON.parse(JSON.stringify(game)) as Record<
      string,
      unknown
    >
    const pools = validState.playersFollowers as Record<
      string,
      Record<string, number>
    >
    pools['1'].ordinaryFollowers = -1
    expect(() => deserializeGameState(validState)).toThrow('follower pool')
  })

  it.each([
    ['некорректный JSON', '{broken'],
    ['объект без идентификатора', { players: [] }],
    ['некорректный список игроков', { id: 'bad', players: {} }],
  ])('отклоняет повреждённое сохранение: %s', (_name, value) => {
    expect(() => deserializeGameState(value)).toThrow()
  })
})
