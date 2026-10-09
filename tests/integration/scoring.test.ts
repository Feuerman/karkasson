import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IGameBoard } from '@server/modules/GameManager'
import { ActionTypes } from '@server/modules/types'
import { TestClient } from './helpers/client'
import {
  assertFollowerInvariants,
  countPlacedTiles,
  createLobbyWithSingleHuman,
  playFullGame,
  verifyScoringAgainstServer,
  waitForHumanTurnOrEnd,
  type GameStateSnapshot,
} from './helpers/gameplay'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('Подсчёт очков и полная партия', () => {
  let server: RunningServer | undefined
  const clients: TestClient[] = []

  afterEach(async () => {
    for (const client of clients) client.dispose()
    clients.length = 0
    if (server) {
      await stopTestServer(server)
      server = undefined
    }
  })

  it('продолжает ждать после интервала тишины до наступления хода человека', async () => {
    const game = {
      gameIsStarted: true,
      gameIsEnded: false,
      currentPlayer: { id: 1 },
      isPlacingFollower: false,
    } as GameStateSnapshot
    let waitCount = 0
    const waitForEvent = vi.fn(async () => {
      waitCount++
      if (waitCount === 2) return game
      throw new Error('quiet interval elapsed')
    })
    const client = { waitForEvent } as unknown as TestClient

    await expect(
      waitForHumanTurnOrEnd(client, 1, { quietMs: 10, timeoutMs: 100 })
    ).resolves.toBe(game)
    expect(waitCount).toBe(3)
  })

  /** Ожидает, пока сохранённая в БД игра не пройдёт проверку */
  async function waitForDbGame(
    gameId: string,
    predicate: (game: IGameBoard) => boolean,
    timeoutMs = 15_000
  ): Promise<IGameBoard | null> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const game = await server!.db.getGame(gameId)
      if (game && predicate(game)) return game
      await sleep(50)
    }
    return server!.db.getGame(gameId)
  }

  it('полная партия: ходы завершаются, очки сходятся, фишки возвращаются', async () => {
    server = await startTestServer()
    const { gameId, creator, aliceId } = await createLobbyWithSingleHuman(
      server.url
    )
    clients.push(creator)

    const stats = await playFullGame(creator, gameId, aliceId)
    const endState = stats.endState

    // Игра действительно завершилась
    expect(endState.gameIsEnded).toBe(true)

    // На доске лежат все тайлы колоды (71 ход + стартовый = 72)
    expect(countPlacedTiles(endState.tilePlacesStats)).toBe(72)

    // Алиса ходила не менее 10 раз (колода / число игроков ≈ 16)
    expect(stats.aliceTurns).toBeGreaterThan(10)

    // За партию завершались дороги и города (их статистику сервер ведёт).
    // Монастыри проверяются «на лету» (verifyScoringAgainstServer ниже),
    // т.к. замыкание монастыря зависит от случайной формы доски.
    expect(stats.completedAtEnd.roads).toBeGreaterThan(0)
    expect(stats.completedAtEnd.cities).toBeGreaterThan(0)

    // Алиса размещала фишки
    expect(stats.followersPlaced).toBeGreaterThan(0)

    // Детерминированный учёт фишек Алисы: каждая размещённая фишка либо
    // вернулась в запас (строение завершилось), либо осталась на доске на
    // незавершённом объекте. Сколько именно возвратов случится — зависит от
    // случайной формы доски, поэтому жёсткое «> 0» здесь было бы флейки-тестом.
    // А сам механизм возврата «не остаётся фишек на завершённых строениях»
    // детерминированно проверяется в assertFollowerInvariants ниже.
    expect(stats.aliceFollowerReturns + stats.aliceFollowersOnBoardAtEnd).toBe(
      stats.aliceFollowedObjects
    )

    // Каждое начисление очков в истории приходит с детализацией расчёта,
    // а строки детализации сходятся с начисленной игроку суммой.
    const scoreActions = (endState.actionsHistory ?? []).filter(
      (action) => action.actionType === ActionTypes.ADDING_SCORES
    )
    expect(scoreActions.length).toBeGreaterThan(0)
    for (const action of scoreActions) {
      const { details, modifiers, score } = action.actionData ?? {}
      expect(
        details?.length,
        `нет детализации: ${JSON.stringify(details)}`
      ).toBeGreaterThan(0)
      expect(Array.isArray(modifiers)).toBe(true)
      expect(details!.every((line) => line.count > 0)).toBe(true)

      const detailsTotal = details!.reduce((sum, line) => sum + line.total, 0)
      const awarded = Object.values(score?.players ?? {})
      // При ничьей за объект очки получает несколько игроков, поэтому
      // сумма строк совпадает с начисленным одному лидеру, а не с общей.
      if (awarded.length === 1) {
        expect(detailsTotal).toBe(awarded[0])
      } else {
        expect(awarded.length).toBeGreaterThan(0)
        expect(awarded.every((value) => value === detailsTotal)).toBe(true)
      }
    }

    // Каждая запись истории принадлежит конкретному ходу: интерфейс
    // группирует записи по нему и рисует заголовок «Ход N».
    const history = endState.actionsHistory ?? []
    expect(
      history.every((action) => Number.isInteger(action.moveNumber)),
      `запись без номера хода: ${JSON.stringify(history.find((action) => !Number.isInteger(action.moveNumber)))}`
    ).toBe(true)
    expect(
      history.every(
        (action) =>
          action.moveNumber! >= 1 && action.moveNumber! <= endState.moveCounter
      )
    ).toBe(true)

    // Начисления по итогам партии помечены флагом и образуют хвост истории.
    // В этом лобби финальный подсчёт выключен, поэтому помеченных записей
    // быть не должно вовсе (проверка самого флага — в finalScoring.test.ts).
    const finalScoringFlags = scoreActions.map(
      (action) => action.actionData?.isFinalScoring === true
    )
    expect(endState.finalScoringEnabled).toBe(false)
    expect(finalScoringFlags.some(Boolean)).toBe(false)

    // Итоговые очки равны сумме очков за завершённые строения
    verifyScoringAgainstServer(endState)
    assertFollowerInvariants(endState)

    // Итоговый счёт неотрицателен и кто-то набрал больше нуля
    const total = Object.values(endState.scores ?? {}).reduce(
      (sum, value) => sum + value,
      0
    )
    expect(total).toBeGreaterThan(0)

    // Состояние партии сохранилось в БД сервера
    const saved = await waitForDbGame(
      gameId,
      (game) => game.gameIsEnded === true
    )
    expect(saved).not.toBeNull()
    expect(saved!.gameIsEnded).toBe(true)
    expect(saved!.moveCounter).toBe(endState.moveCounter)
  }, 240_000)
})
