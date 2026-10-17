import { describe, expect, it } from 'vitest'
import { ActionTypes, SocketEvents } from '@server/modules/types'
import { TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import {
  assertFollowerInvariants,
  countPlacedTiles,
  type GameStateSnapshot,
  verifyScoringAgainstServer,
} from './helpers/gameplay'
import { startTestServer, type RunningServer } from './helpers/server'
import { createLobby } from './helpers/lobby'

describe('Полностью автоматическая партия (4 компьютера)', () => {
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

  it.each([1, 2, 3])(
    'игра с дополнением «Принцесса и дракон» доигрывается до конца (запуск %i)',
    async () => {
      server = await startTestServer()
      const { gameId, creator } = await createLobby(server.url, {
        deviceId: 'device-spectator',
        computerOnly: true,
        rules: { princessAndDragonEnabled: true },
      })
      clients.push(creator)

      // Старт автоматически запускает цепочку компьютерных ходов
      creator.emit(SocketEvents.StartGame, { gameId })

      const startedState = await creator.waitForEvent<GameStateSnapshot>(
        SocketEvents.GameUpdated,
        (game) => game.gameIsStarted === true && game.gameIsEnded === false
      )
      expect(startedState.gameIsStarted).toBe(true)
      expect(startedState.tilePlacesStats[15]?.[15]).toBeTruthy()

      // Ждём завершения партии (71 ход колоды + стартовый тайл)
      const ended = await creator.waitForEvent<GameStateSnapshot>(
        SocketEvents.GameUpdated,
        (game) => game.gameIsEnded === true,
        120_000
      )
      expect(ended.gameIsEnded).toBe(true)

      // Победителя присылает сервер, и он совпадает с максимумом в таблице очков
      const winnerIds = ended.winnerPlayerIds ?? []
      expect(winnerIds.length).toBeGreaterThan(0)
      const scores = Object.entries(ended.scores ?? {})
      const best = scores.reduce(
        (max, [, score]) => Math.max(max, score),
        -Infinity
      )
      expect(winnerIds.length).toBe(scores.filter(([, s]) => s === best).length)
      winnerIds.forEach((id) => {
        expect(scores.find(([key]) => key === String(id))?.[1]).toBe(best)
      })

      expect(countPlacedTiles(ended.tilePlacesStats)).toBeGreaterThan(72)
      expect(countPlacedTiles(ended.tilePlacesStats)).toBeLessThanOrEqual(101)
      const placedTiles = Object.values(ended.tilePlacesStats).flatMap((row) =>
        Object.values(row ?? {})
      )
      expect(
        placedTiles.filter((tile) => tile.id.startsWith('PAD_')).length
      ).toBeGreaterThan(0)
      expect(
        placedTiles.filter((tile) => tile.id.startsWith('PAD_')).length
      ).toBeLessThanOrEqual(29)
      expect(
        ended.actionsHistory?.filter(
          (action) =>
            action.actionType === ActionTypes.PLACE_FOLLOWER &&
            !action.initiator?.socketId &&
            !action.initiator?.deviceId
        ).length
      ).toBeGreaterThan(0)

      // Очки согласуются с завершёнными строениями, фишки не потеряны
      verifyScoringAgainstServer(ended)
      assertFollowerInvariants(ended)

      // Общий список игр обновлён: игра помечена как завершённая
      const { games } = await creator.emitAck<{
        games: Array<{ id: string; gameIsEnded: boolean }>
      }>(SocketEvents.GetGamesList)
      const summary = games.find((g) => g.id === gameId)
      expect(summary?.gameIsEnded).toBe(true)

      // Финальное состояние сохранено в базе
      const saved = await server.db.getGame(gameId)
      expect(saved).not.toBeNull()
      expect(saved!.gameIsEnded).toBe(true)
      expect(saved!.moveCounter).toBe(ended.moveCounter)
    },
    180_000
  )
})
