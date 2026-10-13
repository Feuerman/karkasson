import type { Point } from '../../../modules/types'
import { SocketEvents } from '../../../modules/types'
import { maybeContinueWithComputerMove } from '../../../services/computerPlayer'
import type { SocketCallback, SocketHandlerContext } from '../../types'
import { GameErrors } from '../../../modules/errors'
import { runGameCommand } from '../gameCommand'

export function registerPrincessHandlers(context: SocketHandlerContext) {
  const { events, service, socket } = context

  socket.on(
    SocketEvents.ChoosePrincess,
    async (
      {
        gameId,
        cityId,
        point,
      }: { gameId: string; cityId: string; point: Point },
      callback: SocketCallback
    ) => {
      await runGameCommand(context, {
        gameId,
        command: SocketEvents.ChoosePrincess,
        callback,
        execute: async ({ game, save, ack }) => {
          if (!game.princessChoice) {
            throw new Error(GameErrors.PrincessChoiceNotPending)
          }
          if (
            typeof cityId !== 'string' ||
            !point ||
            !game.choosePrincessFollower(cityId, point)
          ) {
            throw new Error(GameErrors.InvalidPrincessCity)
          }
          await save()
          ack()
          maybeContinueWithComputerMove(events, service, game, gameId)
        },
      })
    }
  )
}
