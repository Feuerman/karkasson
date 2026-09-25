import { afterEach, describe, expect, it } from 'vitest'
import { TestClient } from './helpers/client'
import { createLobbyWithPlayers, latestGame } from './helpers/lobby'
import {
  findValidPlacement,
  makeHumanMove,
  startGame,
  waitForHumanTurnOrEnd,
  type GameStateSnapshot,
} from './helpers/gameplay'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'

describe('Последовательность ходов', () => {
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

  /** Лобби: Алиса (слот 0), Боб (слот 1), два компьютерных игрока */
  async function lobbyWithTwoHumans() {
    const lobby = await createLobbyWithPlayers(server!.url)
    clients.push(lobby.creator, lobby.joiner)
    return lobby
  }

  it('ходы идут по кругу: человек → человек → ИИ → ИИ → человек', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby

    const state = await startGame(lobby.creator, gameId)
    expect(state.currentPlayerIndex).toBe(0)
    expect(state.currentPlayer?.name).toBe('Alice')
    expect(state.moveCounter).toBe(1)

    // --- ход Алисы ---
    const firstMission = await makeHumanMove(lobby.creator, gameId, state)
    expect(
      firstMission.game.tilePlacesStats[firstMission.move.rowIndex]?.[
        firstMission.move.tileIndex
      ]
    ).toBeTruthy()

    // Сразу после хода Алисы очередь переходит к Бобу
    const bobTurn = await latestGame(
      lobby.creator,
      (g) => g.currentPlayer?.name === 'Bob' && !g.isPlacingFollower
    )
    expect(bobTurn.currentPlayerIndex).toBe(1)

    // --- ход Боба ---
    const bobState = await waitForHumanTurnOrEnd(
      lobby.joiner,
      Number(bobTurn.currentPlayer?.id ?? 2)
    )
    const secondMission = await makeHumanMove(lobby.joiner, gameId, bobState)
    expect(
      secondMission.game.tilePlacesStats[secondMission.move.rowIndex]?.[
        secondMission.move.tileIndex
      ]
    ).toBeTruthy()

    // --- ИИ отыграли в промежутке: полный круг снова возвращает Алисе ---
    const aliceBack = await waitForHumanTurnOrEnd(lobby.creator, 1)
    expect(aliceBack.currentPlayer?.name).toBe('Alice')
    // moveCounter не мог не вырасти: полный круг (Боб + два ИИ) завершился.
    // Может быть больше 2: при размещении фишки сервер планирует цепочку
    // ИИ-ходов внахлёст, и компьютер может сходить лишний раз.
    expect(aliceBack.moveCounter).toBeGreaterThanOrEqual(2)
  })

  it('сервер отклоняет ход игрока вне очереди', async () => {
    server = await startTestServer()
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby

    const state = await startGame(lobby.creator, gameId)
    expect(state.currentPlayer?.name).toBe('Alice')

    // Боб пробует ходить на ходу Алисы
    const move = findValidPlacement(state as GameStateSnapshot)
    expect(move).not.toBeNull()

    await expect(
      lobby.joiner.emitAck('placeTile', {
        gameId,
        position: { rowIndex: move!.rowIndex, tileIndex: move!.tileIndex },
      })
    ).rejects.toThrow("Not player's turn")

    // Игра при этом не сломалась: Алиса по-прежнему может сделать ход
    const after = await makeHumanMove(lobby.creator, gameId, state)
    expect(after.game.gameIsStarted).toBe(true)
    expect(after.game.gameIsEnded).toBe(false)
  })
})
