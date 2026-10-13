import { describe, expect, it } from 'vitest'
import { GameManager } from '@server/modules/GameManager'
import { SaveErrors } from '@server/modules/errors'
import {
  deserializeGameState,
  GAME_SAVE_SCHEMA_VERSION,
  readGameSummary,
  serializeGameState,
} from '@server/modules/gameSave'
import { ActionTypes, ObjectTypes } from '@server/modules/types'
import { leaderPlayerIds } from '@server/modules/scoring'

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

  it('не сохраняет приватные runtime-флаги класса', () => {
    const game = new GameManager({ players: [], startImmediately: false })
    game.id = 'private-flags'

    const saved = JSON.parse(serializeGameState(game)) as {
      state: Record<string, unknown>
    }

    expect(saved.state).not.toHaveProperty('isPlacingStartTile')
    expect(saved.state).not.toHaveProperty('objectManager')
    expect(saved.state).not.toHaveProperty('followersManager')
  })

  it('сохраняет флаг ожидающего пробуждения дракона', () => {
    const game = new GameManager({ players: [], startImmediately: false })
    game.id = 'pending-dragon'
    game.pendingDragonMovement = true

    const restored = deserializeGameState(serializeGameState(game))

    // Без этого флага дракон не проснётся после перезапуска сервера.
    expect(restored.pendingDragonMovement).toBe(true)
  })

  it('считает ожидающее пробуждение выключенным для старых сохранений', () => {
    const game = new GameManager({ players: [], startImmediately: false })
    game.id = 'legacy-without-dragon-flag'
    const state = JSON.parse(serializeGameState(game)) as {
      state: Record<string, unknown>
    }
    delete state.state.pendingDragonMovement

    const restored = deserializeGameState({
      schemaVersion: GAME_SAVE_SCHEMA_VERSION,
      state: state.state,
    })

    expect(restored.pendingDragonMovement).toBe(false)
  })

  it('возвращает в пул большого подданного при расширении «Таверны и соборы»', () => {
    const game = new GameManager({
      players: [
        {
          id: 1,
          name: 'Alice',
          color: 'coral',
          score: 0,
          socketId: null,
          deviceId: null,
        },
      ],
      innsAndCathedralsEnabled: true,
    })
    game.id = 'big-follower-migration'
    const state = JSON.parse(serializeGameState(game)) as {
      state: Record<string, unknown>
    }
    const pools = state.state.playersFollowers as Record<
      string,
      Record<string, unknown>
    >
    delete pools['1'].bigFollowers

    const restored = deserializeGameState({
      schemaVersion: GAME_SAVE_SCHEMA_VERSION,
      state: state.state,
    })

    expect(restored.playersFollowers[1]?.bigFollowers).toBe(1)
  })

  it('читает сводку партии без разбора состояния', () => {
    const game = new GameManager({
      players: [
        {
          id: 1,
          name: 'Alice',
          color: 'coral',
          score: 0,
          socketId: 'socket-alice',
          deviceId: null,
        },
      ],
    })
    game.id = 'summary-game'
    game.roomCode = '424242'
    game.scores = { 1: 7 }
    const payload = serializeGameState(game)

    const summary = readGameSummary(payload)

    expect(summary).toMatchObject({
      id: 'summary-game',
      roomCode: '424242',
      gameIsStarted: true,
      scores: { 1: 7 },
    })
    expect(summary?.players?.[0]).toMatchObject({ id: 1, name: 'Alice' })
    // Сводка не тянет за собой доску: она нужна для списка лобби.
    expect(summary).not.toHaveProperty('tilePlacesStats')
  })

  it.each([
    ['нечитаемый JSON', '{broken'],
    ['объект без идентификатора', { state: { players: [] } }],
  ])('пропускает повреждённую запись в сводке: %s', (_name, value) => {
    expect(readGameSummary(value)).toBeUndefined()
  })

  it('сохраняет набор тайлов и фишек выбранного дополнения', () => {
    const game = new GameManager({
      players: [],
      startImmediately: false,
      innsAndCathedralsEnabled: true,
      riverEnabled: true,
      princessAndDragonEnabled: true,
    })
    game.id = 'expansion-save'
    const restored = deserializeGameState(serializeGameState(game))

    expect(restored.rules.expansions.innsAndCathedrals).toBe(true)
    expect(restored.rules.expansions.river).toBe(true)
    expect(restored.rules.expansions.princessAndDragon).toBe(true)
    expect(restored.tilesList).toHaveLength(131)
  })

  it('сохраняет незавершённое движение дракона и выбор города принцессы', () => {
    const game = new GameManager({ players: [], startImmediately: false })
    game.id = 'princess-dragon-progress'
    game.dragonPosition = { rowIndex: 15, tileIndex: 15 }
    game.dragonMove = {
      remainingSteps: 3,
      nextPlayerIndex: 1,
      resumePlayerIndex: 0,
      visited: [{ rowIndex: 15, tileIndex: 15 }],
    }
    game.princessChoice = {
      followers: [
        {
          cityId: 'city-1',
          point: { x: 14, y: 15, direction: 'north' },
        },
      ],
    }
    game.princessFollowerPenalty = true

    const restored = deserializeGameState(serializeGameState(game))

    expect(restored.dragonPosition).toEqual({ rowIndex: 15, tileIndex: 15 })
    expect(restored.dragonMove).toEqual(game.dragonMove)
    expect(restored.princessChoice).toEqual(game.princessChoice)
    expect(restored.princessFollowerPenalty).toBe(true)
  })

  it('снимает штраф принцессы в старом сохранении', () => {
    const game = new GameManager({ players: [], startImmediately: false })
    game.id = 'legacy-princess-penalty'
    const legacyState = JSON.parse(JSON.stringify(game)) as Record<
      string,
      unknown
    >
    delete legacyState.princessFollowerPenalty

    const restored = deserializeGameState({
      schemaVersion: GAME_SAVE_SCHEMA_VERSION,
      state: legacyState,
    })

    expect(restored.princessFollowerPenalty).toBe(false)
  })

  it('восстанавливает старое значение правил без флага принцессы и дракона', () => {
    const game = new GameManager({ players: [], startImmediately: false })
    game.id = 'old-expansion-rules'
    const legacyState = JSON.parse(JSON.stringify(game)) as Record<
      string,
      unknown
    >
    const rules = legacyState.rules as {
      expansions: Record<string, unknown>
    }
    delete rules.expansions.princessAndDragon

    const restored = deserializeGameState({
      schemaVersion: 4,
      state: legacyState,
    })

    expect(restored.rules.expansions.princessAndDragon).toBe(false)
  })

  it('восстанавливает список лидеров в сохранении схемы 5', () => {
    const game = new GameManager({ players: [] })
    game.id = 'schema-five-game'
    game.gameIsEnded = true
    game.scores = { 1: 12, 2: 30, 3: 7 }
    const legacyState = JSON.parse(JSON.stringify(game)) as Record<
      string,
      unknown
    >
    delete legacyState.winnerPlayerIds

    const restored = deserializeGameState({
      schemaVersion: 5,
      state: legacyState,
    })

    expect(restored.winnerPlayerIds).toEqual(['2'])
  })

  it('оставляет список лидеров пустым для незавершённой партии схемы 5', () => {
    const game = new GameManager({ players: [] })
    game.id = 'schema-five-running'
    game.gameIsEnded = false
    game.scores = { 1: 12, 2: 30 }
    const legacyState = JSON.parse(JSON.stringify(game)) as Record<
      string,
      unknown
    >
    delete legacyState.winnerPlayerIds

    const restored = deserializeGameState({
      schemaVersion: 5,
      state: legacyState,
    })

    expect(restored.winnerPlayerIds).toEqual([])
  })

  it('сохраняет ничью в списке лидеров', () => {
    const game = new GameManager({ players: [] })
    game.id = 'tie-game'
    game.gameIsEnded = true
    game.scores = { 1: 21, 2: 21, 3: 4 }
    game.winnerPlayerIds = leaderPlayerIds(game.scores)

    expect(game.winnerPlayerIds).toEqual(['1', '2'])
    const restored = deserializeGameState(serializeGameState(game))
    expect(restored.winnerPlayerIds).toEqual(['1', '2'])
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
    expect(restored.finalScoringEnabled).toBe(false)
    expect(restored.rules.expansions.innsAndCathedrals).toBe(false)
    expect(restored.rules.expansions.river).toBe(false)
    expect(restored.rules.expansions.princessAndDragon).toBe(false)
  })

  it('читает сохранение версии 1 и выключает новую настройку по умолчанию', () => {
    const game = new GameManager({ players: [] })
    game.id = 'version-one-game'
    const legacyState = JSON.parse(JSON.stringify(game)) as Record<
      string,
      unknown
    >
    delete legacyState.finalScoringEnabled

    const restored = deserializeGameState({
      schemaVersion: 1,
      state: legacyState,
    })

    expect(restored.finalScoringEnabled).toBe(false)
    expect(restored.rules.expansions.innsAndCathedrals).toBe(false)
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

  it('сохраняет номер хода и признак финального подсчёта в записях истории', () => {
    const game = new GameManager({ players: [], startImmediately: false })
    game.id = 'history-save'
    game.moveCounter = 7
    game.recordAction({
      actionType: ActionTypes.BACK_FOLLOWER,
      actionData: { followers: [] },
    })
    game.recordAction({
      actionType: ActionTypes.ADDING_SCORES,
      actionData: {
        objectType: ObjectTypes.ROAD,
        objectData: { id: 'road-1', points: [], followers: [] },
        score: { total: 2, players: { 1: 2 } },
        isFinalScoring: true,
      },
    })

    const restored = deserializeGameState(serializeGameState(game))
    const history = restored.actionsHistory

    expect(history).toHaveLength(2)
    expect(history.every((action) => action.moveNumber === 7)).toBe(true)
    const finalScoring = history.find(
      (action) => action.actionType === ActionTypes.ADDING_SCORES
    )
    if (finalScoring?.actionType !== ActionTypes.ADDING_SCORES) {
      throw new Error('Expected a final scoring entry')
    }
    expect(finalScoring.actionData.isFinalScoring).toBe(true)
  })

  it('принимает сохранения старых версий: записи истории без номера хода', () => {
    const game = new GameManager({ players: [], startImmediately: false })
    game.id = 'history-legacy-save'
    const startTile = game.tilesList[0]
    if (!startTile) throw new Error('Expected tiles in the deck')

    const legacyState = JSON.parse(JSON.stringify(game)) as Record<
      string,
      unknown
    >
    legacyState.actionsHistory = [
      {
        actionType: ActionTypes.PLACE_TILE,
        actionData: { tile: startTile, rowIndex: 15, tileIndex: 16 },
      },
    ]

    const restored = deserializeGameState({
      schemaVersion: 4,
      state: legacyState,
    })

    expect(restored.actionsHistory).toHaveLength(1)
    expect(restored.actionsHistory[0]?.moveNumber).toBeUndefined()
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
    expect(() => deserializeGameState(state)).toThrow(
      SaveErrors.SaveInvalidTile
    )

    const validState = JSON.parse(JSON.stringify(game)) as Record<
      string,
      unknown
    >
    const pools = validState.playersFollowers as Record<
      string,
      Record<string, number>
    >
    pools['1'].ordinaryFollowers = -1
    expect(() => deserializeGameState(validState)).toThrow(
      SaveErrors.SaveInvalidFollowerPool
    )

    const invalidBigFollowerPool = JSON.parse(JSON.stringify(game)) as Record<
      string,
      unknown
    >
    const invalidPools = invalidBigFollowerPool.playersFollowers as Record<
      string,
      Record<string, number>
    >
    invalidPools['1'].bigFollowers = -1
    expect(() => deserializeGameState(invalidBigFollowerPool)).toThrow(
      SaveErrors.SaveInvalidFollowerPool
    )
  })

  it.each([
    ['некорректный JSON', '{broken'],
    ['объект без идентификатора', { players: [] }],
    ['некорректный список игроков', { id: 'bad', players: {} }],
  ])('отклоняет повреждённое сохранение: %s', (_name, value) => {
    expect(() => deserializeGameState(value)).toThrow()
  })
})
