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
  type Scores,
} from '../modules/types'

export interface GameSummaryPlayer {
  id: PlayerId
  name: string | null
  color: string | null
  socketId: string | null
  deviceId: string | null
}

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
    players: (game.players ?? []).map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      socketId: player.socketId,
      deviceId: player.deviceId,
    })),
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
