/**
 * Представление партии для клиента.
 *
 * К реестру и лобби отношения не имеет: это только формат широковещательного
 * сообщения. Состояние партии отдаётся целиком по тем же полям, что и в
 * сохранении, кроме колоды: клиенту нужен только размер колоды, а не её
 * состав.
 */

import type { IGameState } from '../modules/gameState'
import type { GameManager } from '../modules/GameManager'
import type { AbbotRecallInfo, FollowerType } from '../modules/types'

export interface GameData {
  placingPoint?: IGameState['placingPoint']
  tilePlacesStats: IGameState['tilePlacesStats']
  /** Сколько тайлов осталось в колоде: клиенту нужен только размер. */
  tilesCount: number
  dragonMove?: IGameState['dragonMove']
  princessChoice?: IGameState['princessChoice']
  princessFollowerPenalty?: IGameState['princessFollowerPenalty']
  dragonPosition?: IGameState['dragonPosition']
  currentTile: IGameState['currentTile']
  players: IGameState['players']
  currentPlayerIndex: number
  availableFollowersPlaces: IGameState['availableFollowersPlaces']
  /** Типы фишек, доступные в каждом месте, по id объекта. */
  availableFollowerTypes: Record<string, FollowerType[]>
  /** Что даст отзыв аббата текущему игроку, либо `null`. */
  abbotRecall: AbbotRecallInfo | null
  gameIsEnded: boolean
  finalScoringEnabled: boolean
  rules: IGameState['rules']
  moveCounter: number
  id: string | undefined
  roomCode?: string
  isPlacingFollower: boolean
  scores: IGameState['scores']
  gameIsStarted: boolean
  gridSize: number[]
  completedObjects: IGameState['completedObjects']
  temporaryObjects: IGameState['temporaryObjects']
  lastPlacement: IGameState['lastPlacement']
  availablePlacesTiles: IGameState['availablePlacesTiles']
  playersFollowers: IGameState['playersFollowers']
  actionsHistory: IGameState['actionsHistory']
  currentPlayer: IGameState['currentPlayer']
  placedFollowers: IGameState['placedFollowers']
  winnerPlayerIds: IGameState['winnerPlayerIds']
  lastUpdate: number
}

/**
 * Состояние для клиента.
 *
 * `tileHistory` сюда не входит: клиент его нигде не читает, а список растёт
 * с каждым ходом и раздувал бы каждое широковещательное сообщение. История
 * тайлов остаётся в сохранении, где она и нужна.
 */
export function formatGameData(game: GameManager): GameData {
  return {
    placingPoint: game.placingPoint,
    tilePlacesStats: game.tilePlacesStats,
    tilesCount: game.tilesList.length,
    dragonMove: game.dragonMove,
    princessChoice: game.princessChoice,
    princessFollowerPenalty: game.princessFollowerPenalty,
    dragonPosition: game.dragonPosition,
    currentTile: game.currentTile,
    players: game.players,
    currentPlayerIndex: game.currentPlayerIndex,
    availableFollowersPlaces: game.availableFollowersPlaces,
    availableFollowerTypes: collectAvailableFollowerTypes(game),
    abbotRecall: game.getAbbotRecallInfo(),
    gameIsEnded: game.gameIsEnded,
    finalScoringEnabled: game.finalScoringEnabled,
    rules: game.rules,
    moveCounter: game.moveCounter,
    id: game.id,
    roomCode: game.roomCode,
    isPlacingFollower: game.isPlacingFollower,
    scores: game.scores,
    gameIsStarted: game.gameIsStarted,
    gridSize: game.gridSize,
    completedObjects: game.completedObjects,
    temporaryObjects: game.temporaryObjects,
    lastPlacement: game.lastPlacement,
    availablePlacesTiles: game.availablePlacesTiles,
    playersFollowers: game.playersFollowers,
    actionsHistory: game.actionsHistory,
    currentPlayer: game.currentPlayer,
    placedFollowers: game.placedFollowers,
    winnerPlayerIds: game.winnerPlayerIds,
    lastUpdate: game.lastUpdate,
  }
}

/**
 * Допустимые типы фишек по каждому доступному месту. Ключ — id объекта:
 * место и объект однозначно совпадают, а сами места уже передаются отдельным
 * полем, поэтому клиенту достаточно посмотреть список по своему объекту.
 */
function collectAvailableFollowerTypes(
  game: GameManager
): Record<string, FollowerType[]> {
  return Object.fromEntries(
    game.availableFollowersPlaces.map((place) => [
      place.temporaryObject.id,
      game.getAvailableFollowerTypes(place),
    ])
  )
}
