import { describe, expect, it } from 'vitest'
import { TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import { createLobbyWithPlayers } from './helpers/lobby'
import {
  countPlacedTiles,
  makeHumanMove,
  startGame,
  waitForHumanTurnOrEnd,
} from './helpers/gameplay'
import { startTestServer, type RunningServer } from './helpers/server'

describe('Последовательность ходов', () => {
  let server: RunningServer | undefined
  const clients: TestClient[] = []

  registerIntegrationCleanup({
    getServer: () => server,
    clearServer: () => {
      server = undefined
    },
    disposeClients: () => {
      for (const client of clients) client.dispose()
      clients.length = 0
    },
  })

  /** Партия Алисы (слот 0) и Боба (слот 1) с двумя компьютерами */
  async function lobbyWithTwoHumans() {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)
    return lobby
  }

  it('ходы идут по кругу: человек → человек → ИИ → ИИ → человек', async () => {
    const { gameId, creator, joiner, playerIds } = await lobbyWithTwoHumans()
    const [aliceId, bobId] = playerIds
    if (aliceId === undefined || bobId === undefined) {
      throw new Error('Игроки лобби не созданы')
    }

    const state = await startGame(creator, gameId)
    const tilesBefore = countPlacedTiles(state.tilePlacesStats)

    // Ход Алисы: тайл размещён, и очередь сразу перешла Бобу — компьютеры
    // между соседними людьми не вклиниваются.
    await makeHumanMove(creator, gameId, state)
    const bobTurn = await waitForHumanTurnOrEnd(joiner, bobId)
    expect(bobTurn.currentPlayer?.id).toBe(bobId)
    expect(countPlacedTiles(bobTurn.tilePlacesStats)).toBe(tilesBefore + 1)

    // Ход Боба, затем два ИИ: полный круг возвращает очередь Алисе.
    await makeHumanMove(joiner, gameId, bobTurn)
    const aliceBack = await waitForHumanTurnOrEnd(creator, aliceId)
    expect(aliceBack.currentPlayer?.id).toBe(aliceId)
    expect(aliceBack.currentPlayerIndex).toBe(state.currentPlayerIndex)
    // Тайл Боба и тайлы двух компьютеров. Больше быть не может: при
    // размещении фишки сервер планирует цепочки ИИ-ходов внахлёст.
    expect(countPlacedTiles(aliceBack.tilePlacesStats)).toBeGreaterThanOrEqual(
      tilesBefore + 4
    )
  }, 30_000)
})
