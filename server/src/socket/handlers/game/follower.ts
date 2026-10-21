import type {
  AvailableFollowerPlace,
  FollowerType,
} from '../../../modules/types'
import {
  FollowerType as FollowerTypes,
  SocketEvents,
} from '../../../modules/types'
import type { SocketCallback, SocketHandlerContext } from '../../types'
import { GameErrors } from '../../../modules/errors'
import { runGameCommand } from '../gameCommand'

export function registerFollowerHandlers(context: SocketHandlerContext) {
  const { events, service, scheduler, socket } = context

  socket.on(
    SocketEvents.PlaceFollower,
    async (
      {
        gameId,
        place,
        followerType = FollowerTypes.Follower,
      }: {
        gameId: string
        place: AvailableFollowerPlace
        followerType?: FollowerType
      },
      callback: SocketCallback
    ) => {
      await runGameCommand(context, {
        gameId,
        command: SocketEvents.PlaceFollower,
        callback,
        execute: async ({ game }) => {
          if (game.princessChoice || game.dragonMove) {
            throw new Error(GameErrors.ResolveExpansionActionFirst)
          }

          const availablePlace = game.availableFollowersPlaces.find(
            (candidate) =>
              candidate.temporaryObject.id === place?.temporaryObject?.id &&
              candidate.point.x === place?.point?.x &&
              candidate.point.y === place?.point?.y &&
              candidate.point.direction === place?.point?.direction &&
              candidate.point.pointType === place?.point?.pointType
          )
          if (!availablePlace) {
            throw new Error(GameErrors.InvalidFollowerPlacement)
          }
          // Допустимость типа фишки решает домен: сервер заново проверяет
          // правила по состоянию партии, транспорт их не дублирует.

          const followersBefore = game.placedFollowers.length
          game.placeFollower(availablePlace, followerType)
          if (game.placedFollowers.length !== followersBefore + 1) {
            throw new Error(GameErrors.FollowerPlacementUnavailable)
          }
        },
        afterSave: (game) => {
          scheduler.maybeContinue(events, service, game, gameId)
        },
      })
    }
  )

  socket.on(
    SocketEvents.RecallAbbot,
    async ({ gameId }: { gameId: string }, callback: SocketCallback) => {
      await runGameCommand(context, {
        gameId,
        command: SocketEvents.RecallAbbot,
        callback,
        execute: async ({ game }) => {
          if (!game.recallAbbot()) {
            throw new Error(GameErrors.NoAbbotOnBoard)
          }
        },
        afterSave: (game) => {
          // Отзыв не расходует ход, но очередь могла уже перейти к компьютеру
          scheduler.maybeContinue(events, service, game, gameId)
        },
      })
    }
  )

  socket.on(
    SocketEvents.SkipFollower,
    async ({ gameId }: { gameId: string }, callback: SocketCallback) => {
      await runGameCommand(context, {
        gameId,
        command: SocketEvents.SkipFollower,
        callback,
        execute: async ({ game }) => {
          if (game.princessChoice || game.dragonMove) {
            throw new Error(GameErrors.ResolveExpansionActionFirst)
          }
          // Пропуск фишек допустим только на фазе выставления: иначе игрок
          // смог бы пропустить ход с уже выложенным тайлом и передать очередь.
          if (!game.isPlacingFollower) {
            throw new Error(GameErrors.NotPlacingFollower)
          }

          game.skipFollower()
        },
        afterSave: (game) => {
          scheduler.maybeContinue(events, service, game, gameId)
        },
      })
    }
  )
}
