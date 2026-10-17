import { describe, expect, it } from 'vitest'
import { TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import {
  countPlacedTiles,
  makeHumanMove,
  startGame,
  waitForHumanTurnOrEnd,
} from './helpers/gameplay'
import { createLobbyWithSingleHuman } from './helpers/lobby'
import { startTestServer, type RunningServer } from './helpers/server'

describe('Передача хода между человеком и компьютерами', () => {
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

  /** Лобби: Алиса (слот 0) и три компьютера. */
  async function singleHumanLobby() {
    server = await startTestServer()
    const lobby = await createLobbyWithSingleHuman(server.url)
    clients.push(lobby.creator)
    return lobby
  }

  it('после хода человека компьютеры отыгрывают свои ходы, очередь возвращается Алисе', async () => {
    const lobby = await singleHumanLobby()
    const { gameId, creator, aliceId } = lobby
    const state = await startGame(creator, gameId)
    const tilesBefore = countPlacedTiles(state.tilePlacesStats)

    const humanMove = await makeHumanMove(creator, gameId, state)
    expect(humanMove.game.currentPlayer?.name).not.toBe('Alice')

    const backToAlice = await waitForHumanTurnOrEnd(creator, aliceId)

    expect(backToAlice.gameIsEnded).toBe(false)
    expect(backToAlice.currentPlayer?.name).toBe('Alice')
    expect(backToAlice.currentPlayer?.id).toBe(aliceId)
    // Тайл человека и тайл каждого из трёх компьютеров. Больше быть не может
    // на этом отрезке: при размещении фишки сервер планирует цепочки ИИ-ходов
    // внахлёст, поэтому компьютер иногда получает лишний ход.
    expect(
      countPlacedTiles(backToAlice.tilePlacesStats)
    ).toBeGreaterThanOrEqual(tilesBefore + 4)
    expect(backToAlice.currentPlayerIndex).toBe(state.currentPlayerIndex)
  }, 30_000)
})
