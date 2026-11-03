import { GameErrors } from '../../../modules/errors'
import { SocketEvents, type Point } from '../../../modules/types'
import type { SocketCallback, SocketHandlerContext } from '../../types'
import { runGameCommand } from '../gameCommand'

export function registerFairyHandlers(context: SocketHandlerContext) {
  const { events, service, scheduler, socket } = context

  socket.on(
    SocketEvents.MoveFairy,
    async (
      { gameId, point }: { gameId: string; point: Point },
      callback: SocketCallback
    ) => {
      await runGameCommand(context, {
        gameId,
        command: SocketEvents.MoveFairy,
        callback,
        execute: async ({ game }) => {
          if (game.princessChoice || game.dragonMove) {
            throw new Error(GameErrors.ResolveExpansionActionFirst)
          }
          if (!game.isPlacingFollower && !game.isPlacingFairy) {
            throw new Error(GameErrors.NotPlacingFairy)
          }
          if (
            !point ||
            typeof point.x !== 'number' ||
            typeof point.y !== 'number'
          ) {
            throw new Error(GameErrors.InvalidFairyTarget)
          }
          if (!game.moveFairyToFollower(point)) {
            throw new Error(GameErrors.InvalidFairyTarget)
          }
        },
        afterSave: (game) => {
          scheduler.maybeContinue(events, service, game, gameId)
        },
      })
    }
  )
}
