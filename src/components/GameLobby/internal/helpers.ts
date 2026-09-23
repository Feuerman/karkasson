import type { GameSummary } from '@server/services/GameService'
import type { Player } from '@server/modules/types'

export const joinButtonIcon = (game: GameSummary): string => {
  if (!game.gameIsStarted) return 'i-lucide-log-in'
  if (!game.gameIsEnded) return 'i-lucide-play'
  return 'i-lucide-download'
}

export const joinButtonLabel = (game: GameSummary): string => {
  if (!game.gameIsStarted) return 'Войти'
  if (!game.gameIsEnded) return 'Продолжить'
  return 'Загрузить'
}

export const isRejoinable = (game: GameSummary, deviceId: string): boolean =>
  game.players?.some((player) => player.deviceId === deviceId)

export const canToggleSlot = (player: Player, deviceId: string): boolean =>
  Boolean(
    (player.socketId && player.deviceId === deviceId) ||
    (!player.socketId && player.name)
  )
