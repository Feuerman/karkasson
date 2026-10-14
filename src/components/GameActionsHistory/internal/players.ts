import type { ComputedRef, InjectionKey } from 'vue'
import type { Player } from '@server/modules/types'

export const HISTORY_PLAYERS_KEY: InjectionKey<ComputedRef<Player[]>> =
  Symbol('historyPlayers')

export const playerById = (
  players: Player[],
  playerId: string | number
): Player | undefined =>
  players.find((player) => String(player.id) === String(playerId))
