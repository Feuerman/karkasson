import { CommonErrors, GameErrors } from '../../../modules/errors'
import { SocketEvents } from '../../../modules/types'
import type { SocketHandlerContext } from '../../types'
import { parseCityRequest, payloadAndCallback } from '../../validation'
import { errorResponse } from '../errorResponse'
import { runGameCommand } from '../gameCommand'

export function registerPrincessHandlers(context: SocketHandlerContext) {
  const { events, service, scheduler, socket } = context

  socket.on(
    SocketEvents.ChoosePrincess,
    async (first: unknown, second: unknown) => {
      const { payload, callback } = payloadAndCallback(first, second)
      const request = parseCityRequest(payload)
      if (!request) {
        callback?.(errorResponse(CommonErrors.InvalidRequest))
        return
      }
      const { gameId, cityId, point } = request

      await runGameCommand(context, {
        gameId,
        command: SocketEvents.ChoosePrincess,
        callback,
        execute: async ({ game }) => {
          if (!game.princessChoice) {
            throw new Error(GameErrors.PrincessChoiceNotPending)
          }
          if (!game.choosePrincessFollower(cityId, point)) {
            throw new Error(GameErrors.InvalidPrincessCity)
          }
        },
        afterSave: (game) => {
          scheduler.maybeContinue(events, service, game, gameId)
        },
      })
    }
  )
}
