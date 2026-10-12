import { afterEach, describe, expect, it } from 'vitest'
import { GameErrors } from '@server/modules/errors'
import { SocketEvents } from '@server/modules/types'
import { TestClient } from './helpers/client'
import { createLobbyWithPlayers, type TestGameData } from './helpers/lobby'
import { findValidPlacement, startGame } from './helpers/gameplay'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'

describe('Конкурентные команды одной партии', () => {
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

  async function lobbyWithTwoHumans() {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)
    return lobby
  }

  /** Задерживает запись в хранилище, чтобы поймать команду, летящую следом. */
  function gateNextSave(delayMs = 100) {
    const database = server!.db
    const originalSave = database.saveGame.bind(database)
    const gate = new Promise<void>((resolve) => setTimeout(resolve, delayMs))
    database.saveGame = async (gameId, gameState) => {
      await gate
      await originalSave(gameId, gameState)
    }
    return gate
  }

  it('команда чужой партии отклоняется, пока очередь занята ходом', async () => {
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby
    const state = await startGame(lobby.creator, gameId)
    const move = findValidPlacement(state)
    expect(move).not.toBeNull()

    const gate = gateNextSave()

    // Алиса ставит тайл; запись ещё в полёте, когда приходит команда Боба
    const placing = lobby.creator.emitAck(SocketEvents.PlaceTile, {
      gameId,
      rotation: move!.tile.rotation,
      position: { rowIndex: move!.rowIndex, tileIndex: move!.tileIndex },
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    const intruder = lobby.joiner.emitAck(SocketEvents.SkipFollower, { gameId })

    await gate
    await placing
    await expect(intruder).rejects.toThrow(GameErrors.NotPlayersTurn)

    const live = server!.handle.gameService.getGame(gameId)
    const placed = Object.values(live?.tilePlacesStats ?? {}).reduce(
      (count, row) => count + Object.keys(row ?? {}).length,
      0
    )
    expect(placed).toBe(
      Object.values(state.tilePlacesStats).reduce(
        (count, row) => count + Object.keys(row ?? {}).length,
        0
      ) + 1
    )
    // Фаза выставления фишек осталась у Алисы: чужая команда её не закрыла
    expect(live?.currentPlayerIndex).toBe(state.currentPlayerIndex)
    expect(live?.isPlacingFollower).toBe(true)
  })

  it('откат неудачной команды не затирает следующую команду', async () => {
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby
    const state = await startGame(lobby.creator, gameId)

    const rotation = state.currentTile!.rotation === 180 ? 90 : 180

    const database = server!.db
    const originalSave = database.saveGame.bind(database)
    const gate = new Promise<void>((resolve) => setTimeout(resolve, 60))
    let failed = false
    database.saveGame = async (gameIdToSave, gameState) => {
      await gate
      if (failed) return originalSave(gameIdToSave, gameState)
      failed = true
      throw new Error('storage unavailable')
    }

    // Первая команда падает на записи и откатывается уже после того, как
    // вторая успела изменить состояние.
    const rotating = lobby.creator.emitAck(SocketEvents.UpdateCurrentTile, {
      gameId,
      rotation,
    })
    const selecting = lobby.creator.emitAck(SocketEvents.SelectPlacingPoint, {
      gameId,
      point: { rowIndex: 15, tileIndex: 16 },
    })

    await expect(rotating).rejects.toThrow('storage unavailable')
    await expect(selecting).resolves.toMatchObject({ success: true })

    const live = server!.handle.gameService.getGame(gameId)
    expect(live?.currentTile?.rotation).toBe(state.currentTile!.rotation)
    expect(live?.placingPoint).toEqual({ rowIndex: 15, tileIndex: 16 })

    const saved = await database.getGame(gameId)
    expect(saved?.placingPoint).toEqual({ rowIndex: 15, tileIndex: 16 })
    expect(saved?.currentTile?.rotation).toBe(state.currentTile!.rotation)
  })

  it('параллельные команды одного игрока дают согласованное состояние', async () => {
    const lobby = await lobbyWithTwoHumans()
    const { gameId } = lobby
    const state = await startGame(lobby.creator, gameId)

    const rotation = state.currentTile!.rotation === 180 ? 90 : 180
    const point = { rowIndex: 15, tileIndex: 16 }

    // Клиент шлёт обе команды, не дожидаясь первой: сервер обязан выполнить
    // их последовательно и оставить память и хранилище одинаковыми.
    const [rotated, selected] = await Promise.all([
      lobby.creator.emitAck<{ success: boolean; game: TestGameData }>(
        SocketEvents.UpdateCurrentTile,
        { gameId, rotation }
      ),
      lobby.creator.emitAck<{ success: boolean; game: TestGameData }>(
        SocketEvents.SelectPlacingPoint,
        {
          gameId,
          point,
        }
      ),
    ])

    expect(rotated.success).toBe(true)
    expect(selected.success).toBe(true)

    const live = server!.handle.gameService.getGame(gameId)
    const saved = await server!.db.getGame(gameId)
    expect(live?.currentTile?.rotation).toBe(rotation)
    expect(live?.placingPoint).toEqual(point)
    expect(saved?.currentTile?.rotation).toBe(rotation)
    expect(saved?.placingPoint).toEqual(point)
  })
})
