import { describe, expect, it, vi } from 'vitest'
import { ackGameUpdated } from '@server/socket/handlers/shared'
import type { IGameBoard } from '@server/modules/GameManager'
import type { GameService } from '@server/services/GameService'
import type { GameEventsPublisher } from '@server/services/gameEvents'

function createHarness() {
  const publishGameUpdated = vi.fn()
  const events = { publishGameUpdated } as unknown as GameEventsPublisher
  const gameData = { id: 'game-1' }
  const service = {
    formatGameData: vi.fn(() => gameData),
  }
  const callback = vi.fn()
  return {
    publishGameUpdated,
    events,
    service,
    callback,
    gameData,
    game: { id: 'game-1' } as unknown as IGameBoard,
  }
}

describe('ackGameUpdated', () => {
  it('публикует gameUpdated и подтверждает ack', () => {
    const { publishGameUpdated, events, service, callback, gameData, game } =
      createHarness()

    ackGameUpdated(
      events,
      service as unknown as GameService,
      'game-1',
      game,
      callback
    )

    expect(publishGameUpdated).toHaveBeenCalledWith('game-1', gameData)
    expect(service.formatGameData).toHaveBeenCalledWith(game)
    expect(callback).toHaveBeenCalledWith({ success: true, game: gameData })
  })

  it('работает без callback', () => {
    const { publishGameUpdated, events, service, game } = createHarness()

    ackGameUpdated(events, service as unknown as GameService, 'game-1', game)

    expect(publishGameUpdated).toHaveBeenCalledWith('game-1', {
      id: 'game-1',
    })
  })
})
