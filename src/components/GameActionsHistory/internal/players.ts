import type { Player } from '@server/modules/types'

export const playerById = (
  players: Player[],
  playerId: string | number
): Player | undefined => players[Number(playerId) - 1]