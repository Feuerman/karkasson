import { describe, expect, it } from 'vitest'
import { GameErrors } from '@server/modules/errors'
import { SocketEvents } from '@server/modules/types'
import { TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import { createLobbyWithPlayers, type LobbySetup } from './helpers/lobby'
import {
  alternateRotation,
  startGame,
  type GameAck,
  type GameStateSnapshot,
} from './helpers/gameplay'
import { delaySaves, failNextSave } from './helpers/storage'
import { sleep } from './helpers/wait'
import { startTestServer, type RunningServer } from './helpers/server'

describe('Конкурентные команды одной партии', () => {
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

  interface StartedTwoHumanGame {
    server: RunningServer
    gameId: string
    lobby: LobbySetup
    state: GameStateSnapshot
  }

  /** Партия двух людей: чужая команда должна отклоняться по очереди хода. */
  async function startedGameWithTwoHumans(): Promise<StartedTwoHumanGame> {
    server = await startTestServer()
    const lobby = await createLobbyWithPlayers(server.url)
    clients.push(lobby.creator, lobby.joiner)
    const state = await startGame(lobby.creator, lobby.gameId)
    return { server, gameId: lobby.gameId, lobby, state }
  }

  it('команда чужой партии отклоняется, пока очередь занята ходом', async () => {
    const { server, gameId, lobby, state } = await startedGameWithTwoHumans()
    const rotation = alternateRotation(state)

    const gate = delaySaves(server.db)

    // Алиса поворачивает тайл; запись ещё в полёте, когда приходит команда Боба.
    // Поворот выбран намеренно: он не двигает очередь, поэтому проверка не
    // зависит от того, остались ли у выложенного тайла места для фишек.
    const rotating = lobby.creator.emitAck(SocketEvents.UpdateCurrentTile, {
      gameId,
      rotation,
    })
    await sleep(20)
    const intruder = lobby.joiner.emitAck(SocketEvents.SelectPlacingPoint, {
      gameId,
      point: { rowIndex: 15, tileIndex: 16 },
    })

    await gate
    await rotating
    await expect(intruder).rejects.toThrow(GameErrors.NotPlayersTurn)

    const live = server.handle.gameService.getGame(gameId)
    expect(live?.currentTile?.rotation).toBe(rotation)
    // Чужая команда не применилась: выбранная точка осталась прежней
    expect(live?.placingPoint).toEqual(state.placingPoint)
    expect(live?.currentPlayerIndex).toBe(state.currentPlayerIndex)
  })

  it('откат неудачной команды не затирает следующую команду', async () => {
    const { server, gameId, lobby, state } = await startedGameWithTwoHumans()
    const rotation = alternateRotation(state)
    const point = { rowIndex: 15, tileIndex: 16 }

    // Первая команда падает на записи и откатывается уже после того, как
    // вторая успела изменить состояние.
    const gate = failNextSave(server.db, new Error('storage unavailable'))

    const rotating = lobby.creator.emitAck(SocketEvents.UpdateCurrentTile, {
      gameId,
      rotation,
    })
    const selecting = lobby.creator.emitAck(SocketEvents.SelectPlacingPoint, {
      gameId,
      point,
    })

    await expect(rotating).rejects.toThrow('storage unavailable')
    await expect(selecting).resolves.toMatchObject({ success: true })
    await gate

    const live = server.handle.gameService.getGame(gameId)
    expect(live?.currentTile?.rotation).toBe(state.currentTile?.rotation)
    expect(live?.placingPoint).toEqual(point)

    const saved = await server.db.getGame(gameId)
    expect(saved?.placingPoint).toEqual(point)
    expect(saved?.currentTile?.rotation).toBe(state.currentTile?.rotation)
  })

  it('параллельные команды одного игрока дают согласованное состояние', async () => {
    const { server, gameId, lobby, state } = await startedGameWithTwoHumans()
    const rotation = alternateRotation(state)
    const point = { rowIndex: 15, tileIndex: 16 }

    // Клиент шлёт обе команды, не дожидаясь первой: сервер обязан выполнить
    // их последовательно и оставить память и хранилище одинаковыми.
    const [rotated, selected] = await Promise.all([
      lobby.creator.emitAck<GameAck>(SocketEvents.UpdateCurrentTile, {
        gameId,
        rotation,
      }),
      lobby.creator.emitAck<GameAck>(SocketEvents.SelectPlacingPoint, {
        gameId,
        point,
      }),
    ])

    expect(rotated.success).toBe(true)
    expect(selected.success).toBe(true)

    const live = server.handle.gameService.getGame(gameId)
    const saved = await server.db.getGame(gameId)
    for (const snapshot of [live, saved]) {
      expect(snapshot?.currentTile?.rotation).toBe(rotation)
      expect(snapshot?.placingPoint).toEqual(point)
    }
  })
})
