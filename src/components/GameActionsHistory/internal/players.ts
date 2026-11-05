import type { ComputedRef, InjectionKey } from 'vue'
import type { PlayerView } from '@server/modules/types'

export const HISTORY_PLAYERS_KEY: InjectionKey<ComputedRef<PlayerView[]>> =
  Symbol('historyPlayers')

export const playerById = (
  players: PlayerView[],
  playerId: string | number
): PlayerView | undefined =>
  players.find((player) => String(player.id) === String(playerId))
