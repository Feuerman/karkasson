import type { Player, PlayerView } from '../modules/types'

/**
 * Публичное представление игрока: без `socketId` и других внутренних полей.
 * `isConnected` вычисляется по наличию сокета, поэтому клиент не получает
 * возможность обращаться к чужому соединению.
 */
export function toPlayerView(player: Player): PlayerView {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    score: player.score,
    sessionId: player.sessionId ?? null,
    isConnected: Boolean(player.socketId),
  }
}
