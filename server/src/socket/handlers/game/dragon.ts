import { SocketEvents } from '../../../modules/types'
import type { SocketCallback, SocketHandlerContext } from '../../types'
import { GameErrors } from '../../../modules/errors'
import { runGameCommand, type GameCommandGuard } from '../gameCommand'

/** Ходы дракона доступны только тому, кому принадлежит очередь и ход дракона. */
const requireDragonTurn: GameCommandGuard = (game, socketId) =>
  game.dragonMove &&
  game.players[game.currentPlayerIndex]?.socketId === socketId
    ? undefined
    : GameErrors.InvalidDragonTurn

export function registerDragonHandlers(context: SocketHandlerContext) {
  const { events, service, scheduler, socket } = context

  socket.on(
    SocketEvents.MoveDragon,
    async (
      {
        gameId,
        position,
      }: { gameId: string; position: { rowIndex: number; tileIndex: number } },
      callback: SocketCallback
    ) => {
      await runGameCommand(context, {
        gameId,
        command: SocketEvents.MoveDragon,
        callback,
        guard: requireDragonTurn,
        execute: async ({ game }) => {
          if (
            !position ||
            !game.moveDragon(position.rowIndex, position.tileIndex)
          ) {
            throw new Error(GameErrors.InvalidDragonDestination)
          }
        },
        afterSave: (game) => {
          scheduler.maybeContinue(events, service, game, gameId)
        },
      })
    }
  )
}
