import { describe, expect, it } from 'vitest'
import { LobbyErrors } from '@server/modules/errors'
import { SocketEvents } from '@server/modules/types'
import { TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import { createLobby, createLobbyWithPlayers } from './helpers/lobby'
import { startGame } from './helpers/gameplay'
import { startTestServer, type RunningServer } from './helpers/server'

describe('Запуск игры', () => {
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

  it('стартует игру с реальными и компьютерными игроками', async () => {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)

    const started = await startGame(lobby.creator, lobby.gameId)

    expect(started.id).toBe(lobby.gameId)
    expect(started.gameIsStarted).toBe(true)
    expect(started.gameIsEnded).toBe(false)
    expect(started.currentPlayerIndex).toBe(0)
    expect(started.currentPlayer?.name).toBe('Alice')

    // Слоты заняли Алиса, Боб и два компьютера: у компьютеров нет сокета
    expect(started.players).toHaveLength(4)
    expect(started.players.slice(0, 2).map((player) => player.name)).toEqual([
      'Alice',
      'Bob',
    ])
    const computerPlayers = started.players.filter(
      (player) => !player.isConnected && !player.sessionId
    )
    expect(computerPlayers).toHaveLength(2)

    // На доске только стартовый тайл в центре
    expect(Object.keys(started.tilePlacesStats)).toEqual(['15'])
    expect(Object.keys(started.tilePlacesStats[15])).toEqual(['15'])

    // Счёт обнулён, первому игроку выдан ставимый тайл
    expect(started.scores).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0 })
    expect(started.currentTile?.sides).toBeDefined()
    expect(started.availablePlacesTiles?.length).toBeGreaterThan(0)

    // Стартовое состояние сохранено в хранилище
    const saved = await server.db.getGame(lobby.gameId)
    expect(saved?.gameIsStarted).toBe(true)
    expect(saved?.tilePlacesStats[15]?.[15]?.id).toBe(
      started.tilePlacesStats[15]?.[15]?.id
    )
  })

  it('не начинает партию с одним игроком и понятно объясняет причину', async () => {
    server = await startTestServer()
    const lobby = await createLobby(server.url, { humans: 1, computers: 0 })
    clients.push(lobby.creator)

    await expect(
      lobby.creator.emitAck(SocketEvents.StartGame, { gameId: lobby.gameId })
    ).rejects.toThrow(LobbyErrors.NotEnoughPlayers)

    const game = server.handle.gameService.getGame(lobby.gameId)
    expect(game?.gameIsStarted).toBe(false)
    const saved = await server.db.getGame(lobby.gameId)
    expect(saved?.gameIsStarted).toBe(false)
  })
})
