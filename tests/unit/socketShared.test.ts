import { describe, expect, it, vi } from 'vitest'
import { ackGameUpdated } from '@server/socket/handlers/shared'
import type { GameManager } from '@server/modules/GameManager'
import type { GameEventsPublisher } from '@server/services/gameEvents'

const formatGameData = vi.fn((_game: unknown) => ({ id: 'game-1' }))

vi.mock('@server/services/gameView', () => ({
  formatGameData: (game: unknown) => formatGameData(game),
}))

function createHarness() {
  const publishGameUpdated = vi.fn()
  const events = { publishGameUpdated } as unknown as GameEventsPublisher
  const gameData = { id: 'game-1' }
  const callback = vi.fn()
  return {
    publishGameUpdated,
    events,
    callback,
    gameData,
    game: { id: 'game-1' } as unknown as GameManager,
  }
}

describe('ackGameUpdated', () => {
  it('публикует gameUpdated и подтверждает ack', () => {
    const { publishGameUpdated, events, callback, gameData, game } =
      createHarness()

    ackGameUpdated(events, 'game-1', game, callback)

    expect(publishGameUpdated).toHaveBeenCalledWith('game-1', gameData)
    expect(formatGameData).toHaveBeenCalledWith(game)
    expect(callback).toHaveBeenCalledWith({ success: true, game: gameData })
  })

  it('работает без callback', () => {
    const { publishGameUpdated, events, game } = createHarness()

    ackGameUpdated(events, 'game-1', game)

    expect(publishGameUpdated).toHaveBeenCalledWith('game-1', {
      id: 'game-1',
    })
  })
})
