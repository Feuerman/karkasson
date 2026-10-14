import { describe, expect, it } from 'vitest'
import { TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import {
  countPlacedTiles,
  createLobbyWithSingleHuman,
  makeHumanMove,
  startGame,
  waitForHumanTurnOrEnd,
} from './helpers/gameplay'
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

  it('после хода человека компьютеры играют ровно по одному разу', async () => {
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
    // Один тайл человека и по одному тайлу каждого компьютера
    expect(countPlacedTiles(backToAlice.tilePlacesStats)).toBe(tilesBefore + 4)
    expect(backToAlice.currentPlayerIndex).toBe(state.currentPlayerIndex)
  }, 30_000)
})
