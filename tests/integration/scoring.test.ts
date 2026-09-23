import { afterEach, describe, expect, it } from 'vitest'
import type { IGameBoard } from '../../server/src/modules/GameManager'
import { TestClient } from './helpers/client'
import {
  assertFollowerInvariants,
  countPlacedTiles,
  createLobbyWithSingleHuman,
  playFullGame,
  verifyScoringAgainstServer,
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
