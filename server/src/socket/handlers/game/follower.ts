import type {
  AvailableFollowerPlace,
  FollowerType,
} from '../../../modules/types'
import {
  FollowerType as FollowerTypes,
  SocketEvents,
} from '../../../modules/types'
import { maybeContinueWithComputerMove } from '../../../services/computerPlayer'
import type { SocketCallback, SocketHandlerContext } from '../../types'
import { GameErrors } from '../../../modules/errors'
import { runGameCommand } from '../gameCommand'

export function registerFollowerHandlers(context: SocketHandlerContext) {
  const { events, service, socket } = context

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
        execute: async ({ game, save, ack }) => {
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
          if (
            !availablePlace ||
            !Object.values(FollowerTypes).includes(followerType)
          ) {
            throw new Error(GameErrors.InvalidFollowerPlacement)
          }
          if (
            followerType === FollowerTypes.Abbot &&
            !(
              availablePlace.temporaryObject.isMonastery ||
              availablePlace.temporaryObject.isGarden
            )
          ) {
            throw new Error(GameErrors.AbbotRequiresMonasteryOrGarden)
          }
          if (
            followerType === FollowerTypes.BigFollower &&
            !game.rules.expansions.innsAndCathedrals
          ) {
            throw new Error(GameErrors.BigFollowerExpansionDisabled)
          }
          if (
            followerType === FollowerTypes.Follower &&
            availablePlace.temporaryObject.isGarden
          ) {
            throw new Error(GameErrors.FollowerNotAllowedOnGarden)
          }

          const followersBefore = game.placedFollowers.length
          game.placeFollower(availablePlace, followerType)
          if (game.placedFollowers.length !== followersBefore + 1) {
            throw new Error(GameErrors.FollowerPlacementUnavailable)
          }

          await save()
          ack()
          maybeContinueWithComputerMove(events, service, game, gameId)
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
        execute: async ({ game, save, ack }) => {
          if (!game.recallAbbot()) {
            throw new Error(GameErrors.NoAbbotOnBoard)
          }
          await save()
          ack()
          // Отзыв не расходует ход, но очередь могла уже перейти к компьютеру
          maybeContinueWithComputerMove(events, service, game, gameId)
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
        execute: async ({ game, save, ack }) => {
          if (game.princessChoice || game.dragonMove) {
            throw new Error(GameErrors.ResolveExpansionActionFirst)
          }
          // Пропуск фишек допустим только на фазе выставления: иначе игрок
          // смог бы пропустить ход с уже выложенным тайлом и передать очередь.
          if (!game.isPlacingFollower) {
            throw new Error(GameErrors.NotPlacingFollower)
          }

          game.skipFollower()
          await save()
          ack()
          maybeContinueWithComputerMove(events, service, game, gameId)
        },
      })
    }
  )
}
