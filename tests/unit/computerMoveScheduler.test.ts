import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameManager } from '@server/modules/GameManager'
import type { Player } from '@server/modules/types'
import { ComputerMoveScheduler } from '@server/services/computerPlayer'
import type { GameService } from '@server/services/GameService'
import type { GameEventsPublisher } from '@server/services/gameEvents'

const computer: Player = {
  id: 1,
  name: 'Computer',
  color: 'lime',
  score: 0,
  socketId: null,
  sessionId: null,
}

function computerGame(id: string): GameManager {
  return {
    id,
    gameIsStarted: true,
    gameIsEnded: false,
    currentPlayer: computer,
    players: [computer],
    tilePlacesStats: {},
  } as unknown as GameManager
}

function createEvents(): GameEventsPublisher {
  return {
    publishGameError: vi.fn(),
    publishGameDeleted: vi.fn(),
    publishGamesList: vi.fn(),
    publishGameUpdated: vi.fn(),
  } as unknown as GameEventsPublisher
}

function createService(games: GameManager[], aiLimit = 1) {
  const registry = new Map(games.map((game) => [game.id, game]))
  return {
    registry,
    getGame: (id: string) => registry.get(id),
    allGames: () => [...registry.values()],
    activeAiGameLimit: () => aiLimit,
    deleteGame: vi.fn(async (id: string) => {
      registry.delete(id)
    }),
    formatGamesList: () => [],
    runGameCommand: <T>(_id: string, command: () => Promise<T>) => command(),
    mutateAndSave: vi.fn(
      () => new Promise<never>(() => undefined)
    ) as unknown as GameService['mutateAndSave'],
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ComputerMoveScheduler', () => {
  it('по watchdog удаляет зависшую партию и не возобновляет ходы', async () => {
    vi.useFakeTimers()
    const service = createService([computerGame('game-1')])
    const events = createEvents()
    const scheduler = new ComputerMoveScheduler({
      moveDelayMs: 1,
      watchdogTimeoutMs: 50,
    })

    const running = scheduler.runMoves(
      events,
      service as unknown as GameService,
      'game-1'
    )
    await vi.advanceTimersByTimeAsync(50)
    await running
    await Promise.resolve()

    expect(service.deleteGame).toHaveBeenCalledWith('game-1')
    expect(events.publishGameError).toHaveBeenCalledWith(
      'game-1',
      'Ход компьютера занял слишком много времени'
    )
    expect(events.publishGameDeleted).toHaveBeenCalledWith('game-1', 'failed')
  })

  it('возобновляет не больше глобального предела автоматических партий', async () => {
    vi.useFakeTimers()
    const service = createService(
      [computerGame('game-1'), computerGame('game-2')],
      1
    )
    const events = createEvents()
    const scheduler = new ComputerMoveScheduler({ moveDelayMs: 10 })

    await scheduler.resumeAll(events, service as unknown as GameService)
    scheduler.cancelAll(['game-1'])

    expect(service.deleteGame).toHaveBeenCalledTimes(1)
    expect(service.deleteGame).toHaveBeenCalledWith('game-2')
    expect(events.publishGameDeleted).toHaveBeenCalledWith('game-2', 'stale')
  })
})
