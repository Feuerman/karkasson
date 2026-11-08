import type { GameSummary } from '@server/services/GameService'
import type { PlayerView } from '@server/modules/types'
import type { IGame } from '@/types/game'
import { TEST_IDS } from '@/data/testIds'
import { t } from '@/utils/i18n'

export const joinButtonIcon = (game: GameSummary): string => {
  if (!game.gameIsStarted) return 'i-lucide-log-in'
  if (!game.gameIsEnded) return 'i-lucide-play'
  return 'i-lucide-download'
}

export const joinButtonLabel = (game: GameSummary): string => {
  if (!game.gameIsStarted) return t('lobby_join')
  if (!game.gameIsEnded) return t('lobby_continue')
  return t('lobby_load')
}

export const isRejoinable = (game: GameSummary, sessionId: string): boolean =>
  Boolean(sessionId) &&
  !game.gameIsEnded &&
  game.players?.some((player) => player.sessionId === sessionId)

export const canToggleSlot = (player: PlayerView, sessionId: string): boolean =>
  Boolean(
    (player.isConnected && player.sessionId === sessionId) ||
    (!player.isConnected && player.name)
  )

/** Список правил партии для отображения в комнате: названия и тестовые идентификаторы. */
export const buildGameRules = (game: IGame) => {
  const expansions = game.rules?.expansions

  return [
    {
      label: t('lobby_final_scoring'),
      enabled: Boolean(game.finalScoringEnabled),
      testId: undefined,
    },
    {
      label: t('expansion_inns'),
      enabled: Boolean(expansions?.innsAndCathedrals),
      testId: undefined,
    },
    {
      label: t('expansion_river'),
      enabled: Boolean(expansions?.river),
      testId: undefined,
    },
    {
      label: t('expansion_princess'),
      enabled: Boolean(expansions?.princessAndDragon),
      testId: TEST_IDS.lobbyPrincessDragonStatus,
    },
  ]
}
