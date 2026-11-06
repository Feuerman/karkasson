import { CommonErrors, GameErrors } from '../../../modules/errors'
import { SocketEvents } from '../../../modules/types'
import type { SocketHandlerContext } from '../../types'
import { parsePointRequest, payloadAndCallback } from '../../validation'
import { errorResponse } from '../errorResponse'
import { runGameCommand } from '../gameCommand'

export function registerFairyHandlers(context: SocketHandlerContext) {
  const { events, service, scheduler, socket } = context

  socket.on(SocketEvents.MoveFairy, async (first: unknown, second: unknown) => {
    const { payload, callback } = payloadAndCallback(first, second)
    const request = parsePointRequest(payload)
    if (!request) {
      callback?.(errorResponse(CommonErrors.InvalidRequest))
      return
    }
    const { gameId, point, commandId } = request

    await runGameCommand(context, {
      gameId,
      command: SocketEvents.MoveFairy,
      commandId,
      callback,
      execute: async ({ game }) => {
        if (game.princessChoice || game.dragonMove) {
          throw new Error(GameErrors.ResolveExpansionActionFirst)
        }
        if (!game.isPlacingFollower && !game.isPlacingFairy) {
          throw new Error(GameErrors.NotPlacingFairy)
        }
        if (!game.moveFairyToFollower(point)) {
          throw new Error(GameErrors.InvalidFairyTarget)
        }
      },
      afterSave: (game) => {
        scheduler.maybeContinue(events, service, game, gameId)
      },
    })
  })
}
