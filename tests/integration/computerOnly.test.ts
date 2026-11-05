import { describe, expect, it } from 'vitest'
import { ActionTypes, SocketEvents } from '@server/modules/types'
import { TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import {
  assertFollowerInvariants,
  countPlacedTiles,
  type GameStateSnapshot,
} from './helpers/gameplay'
import { startTestServer, type RunningServer } from './helpers/server'
import { createLobby } from './helpers/lobby'

function verifyScoresFromHistory(state: GameStateSnapshot): void {
  const expected: Record<string, number> = {}
  for (const player of state.players ?? []) expected[String(player.id)] = 0

  for (const action of state.actionsHistory ?? []) {
    if (action.actionType === ActionTypes.ADDING_SCORES) {
      for (const [playerId, points] of Object.entries(
        action.actionData?.score?.players ?? {}
      )) {
        expected[playerId] = (expected[playerId] ?? 0) + points
      }
    }
    if (action.actionType === ActionTypes.FAIRY_POINT) {
      const playerId = action.actionData?.follower?.playerId
      const points = action.actionData?.points
      if (playerId !== undefined && typeof points === 'number') {
        const key = String(playerId)
        expected[key] = (expected[key] ?? 0) + points
      }
    }
  }

  expect(state.scores).toEqual(expected)
}

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

  it.each([1])(
    'игра с дополнением «Принцесса и дракон» доигрывается до конца (запуск %i)',
    async () => {
      server = await startTestServer()
      const { gameId, creator } = await createLobby(server.url, {
        identity: 'device-spectator',
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
      expect(countPlacedTiles(ended.tilePlacesStats)).toBeLessThanOrEqual(102)
      const placedTiles = Object.values(ended.tilePlacesStats).flatMap((row) =>
        Object.values(row ?? {})
      )
      expect(
        placedTiles.filter((tile) => tile.id.startsWith('PAD_')).length
      ).toBeGreaterThan(0)
      expect(
        placedTiles.filter((tile) => tile.id.startsWith('PAD_')).length
      ).toBeLessThanOrEqual(30)
      expect(
        ended.actionsHistory?.filter(
          (action) =>
            action.actionType === ActionTypes.PLACE_FOLLOWER &&
            !action.initiator?.socketId &&
            !action.initiator?.sessionId
        ).length
      ).toBeGreaterThan(0)

      // Очки согласуются с завершёнными строениями, фишки не потеряны
      verifyScoresFromHistory(ended)
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
