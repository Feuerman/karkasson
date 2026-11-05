import { SocketEvents } from '../../../modules/types'
import type { SocketHandlerContext } from '../../types'
import { CommonErrors, GameErrors } from '../../../modules/errors'
import { parsePositionRequest, payloadAndCallback } from '../../validation'
import { errorResponse } from '../errorResponse'
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
    async (first: unknown, second: unknown) => {
      const { payload, callback } = payloadAndCallback(first, second)
      const request = parsePositionRequest(payload)
      if (!request) {
        callback?.(errorResponse(CommonErrors.InvalidRequest))
        return
      }
      const { gameId, position } = request

      await runGameCommand(context, {
        gameId,
        command: SocketEvents.MoveDragon,
        callback,
        guard: requireDragonTurn,
        execute: async ({ game }) => {
          if (!game.moveDragon(position.rowIndex, position.tileIndex)) {
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
