import { describe, expect, it, vi } from 'vitest'
import { ackGameUpdated } from '@server/socket/handlers/shared'
import { SocketEvents } from '@server/modules/types'
import type { IGameBoard } from '@server/modules/GameManager'
import type { GameService } from '@server/services/GameService'

function createHarness() {
  const emit = vi.fn()
  const io = { to: vi.fn(() => ({ emit })) }
  const gameData = { id: 'game-1' }
  const service = {
    formatGameData: vi.fn(() => gameData),
  }
  const callback = vi.fn()
  return {
    emit,
    io,
    service,
    callback,
    gameData,
    game: { id: 'game-1' } as unknown as IGameBoard,
  }
}

describe('ackGameUpdated', () => {
  it('публикует gameUpdated и подтверждает ack', () => {
    const { emit, io, service, callback, gameData, game } = createHarness()

    ackGameUpdated(
      io as never,
      service as unknown as GameService,
      'game-1',
      game,
      callback
    )

    expect(io.to).toHaveBeenCalledWith('game-1')
    expect(service.formatGameData).toHaveBeenCalledWith(game)
    expect(emit).toHaveBeenCalledWith(SocketEvents.GameUpdated, gameData)
    expect(callback).toHaveBeenCalledWith({ success: true, game: gameData })
  })

  it('работает без callback', () => {
    const { emit, io, service, game } = createHarness()

    ackGameUpdated(
      io as never,
      service as unknown as GameService,
      'game-1',
      game
    )

    expect(emit).toHaveBeenCalledWith(SocketEvents.GameUpdated, {
      id: 'game-1',
    })
  })
})
