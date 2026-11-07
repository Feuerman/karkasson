/**
 * Сводки партий для списка лобби.
 *
 * Источник сведений — живая партия либо запись из хранилища, прочитанная без
 * полного разбора. Формулировка сводки не зависит от способа получения, поэтому
 * она живёт отдельно от реестра партий.
 */

import type { IGameState } from '../modules/gameState'
import {
  DEFAULT_GAME_RULES,
  type GameRules,
  type PlayerId,
  type PlayerView,
  type Scores,
} from '../modules/types'
import { toPlayerView } from './playerView'

export type GameSummaryPlayer = PlayerView

/** Фильтр списка партий в лобби. */
export type GamesListFilter = 'all' | 'waiting' | 'started' | 'ended'

export interface GameSummary {
  id: string | undefined
  roomCode: string
  players: GameSummaryPlayer[]
  currentPlayer: PlayerId | null
  gameIsEnded: boolean
  moveCounter: number
  scores: Scores
  gameIsStarted: boolean
  lastUpdate: number
  rules: GameRules
  /** Финальный подсчёт очков включён: в правилах его больше нет. */
  finalScoringEnabled: boolean
}

/**
 * Источник сведений о партии для списка лобби: живая партия либо сводка,
 * прочитанная из хранилища без полного разбора.
 */
export type GameSummarySource = Partial<
  Pick<
    IGameState,
    | 'roomCode'
    | 'players'
    | 'currentPlayer'
    | 'gameIsEnded'
    | 'moveCounter'
    | 'scores'
    | 'gameIsStarted'
    | 'lastUpdate'
    | 'rules'
    | 'finalScoringEnabled'
  >
> & { id?: string }

export function toGameSummary(game: GameSummarySource): GameSummary {
  return {
    id: game.id,
    roomCode: game.roomCode ?? '',
    players: (game.players ?? []).map(toPlayerView),
    currentPlayer: game.currentPlayer?.id ?? null,
    gameIsEnded: game.gameIsEnded ?? false,
    moveCounter: game.moveCounter ?? 0,
    scores: game.scores ?? {},
    gameIsStarted: game.gameIsStarted ?? false,
    lastUpdate: game.lastUpdate ?? 0,
    rules: game.rules ?? structuredClone(DEFAULT_GAME_RULES),
    finalScoringEnabled: game.finalScoringEnabled ?? false,
  }
}

/** Завершённые партии вперёд, среди них — самые свежие. */
export function sortGameSummaries(games: GameSummary[]): GameSummary[] {
  return [...games].sort((left, right) => {
    if (left.gameIsEnded !== right.gameIsEnded) {
      return left.gameIsEnded ? -1 : 1
    }
    if (left.gameIsEnded) return right.lastUpdate - left.lastUpdate
    return 0
  })
}

/** Фильтрует сводки по статусу партии. */
export function filterGameSummaries(
  games: GameSummary[],
  filter: GamesListFilter
): GameSummary[] {
  if (filter === 'all') return games
  return games.filter((game) => {
    if (filter === 'waiting') return !game.gameIsStarted && !game.gameIsEnded
    if (filter === 'started') return game.gameIsStarted && !game.gameIsEnded
    if (filter === 'ended') return game.gameIsEnded
    return true
  })
}
