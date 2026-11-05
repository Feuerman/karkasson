import { describe, expect, it } from 'vitest'
import { toPlayerView } from '@server/services/playerView'
import { makePlayers } from '../helpers/fixtures'

describe('toPlayerView', () => {
  it('не отдаёт socketId и отмечает подключённого игрока', () => {
    const [player] = makePlayers()

    expect(toPlayerView(player)).toEqual({
      id: player.id,
      name: player.name,
      color: player.color,
      score: player.score,
      sessionId: player.sessionId,
      isConnected: true,
    })
    expect(toPlayerView(player)).not.toHaveProperty('socketId')
  })

  it('отмечает отключённого игрока без сессии', () => {
    const [player] = makePlayers()

    expect(
      toPlayerView({
        ...player,
        socketId: null,
        sessionId: null,
      })
    ).toMatchObject({
      sessionId: null,
      isConnected: false,
    })
  })
})
