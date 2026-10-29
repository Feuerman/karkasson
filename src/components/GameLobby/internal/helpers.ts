import type { GameSummary } from '@server/services/GameService'
import type { Player } from '@server/modules/types'
import type { IGame } from '@/types/game'
import { TEST_IDS } from '@/data/testIds'

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
  !game.gameIsEnded &&
  game.players?.some((player) => player.deviceId === deviceId)

export const canToggleSlot = (player: Player, deviceId: string): boolean =>
  Boolean(
    (player.socketId && player.deviceId === deviceId) ||
    (!player.socketId && player.name)
  )

/** Список правил партии для отображения в комнате: названия и тестовые идентификаторы. */
export const buildGameRules = (game: IGame) => {
  const expansions = game.rules?.expansions

  return [
    {
      label: 'Финальный подсчёт очков',
      enabled: Boolean(game.finalScoringEnabled),
      testId: undefined,
    },
    {
      label: 'Таверны и соборы',
      enabled: Boolean(expansions?.innsAndCathedrals),
      testId: undefined,
    },
    {
      label: 'Река',
      enabled: Boolean(expansions?.river),
      testId: undefined,
    },
    {
      label: 'Принцесса и дракон',
      enabled: Boolean(expansions?.princessAndDragon),
      testId: TEST_IDS.lobbyPrincessDragonStatus,
    },
  ]
}
