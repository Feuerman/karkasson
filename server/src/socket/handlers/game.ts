import type { SocketHandlerContext } from '../types'
import { registerTileHandlers } from './game/tile'
import { registerFollowerHandlers } from './game/follower'
import { registerDragonHandlers } from './game/dragon'
import { registerPrincessHandlers } from './game/princess'

export function registerGameHandlers(context: SocketHandlerContext) {
  registerTileHandlers(context)
  registerFollowerHandlers(context)
  registerDragonHandlers(context)
  registerPrincessHandlers(context)
}
