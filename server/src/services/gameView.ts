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
import type {
  AbbotRecallInfo,
  FollowerType,
  PlayerView,
} from '../modules/types'
import { buildFieldComponents } from '../modules/fieldComponents'
import type { FieldComponent } from '../modules/fieldComponents'
import { toPlayerView } from './playerView'

export interface GameData {
  placingPoint?: IGameState['placingPoint']
  tilePlacesStats: IGameState['tilePlacesStats']
  /** Производный состав связных полей, пересчитанный по выложенным тайлам. */
  fieldComponents: FieldComponent[]
  /** Сколько тайлов осталось в колоде: клиенту нужен только размер. */
  tilesCount: number
  dragonMove?: IGameState['dragonMove']
  princessChoice?: IGameState['princessChoice']
  princessFollowerPenalty?: IGameState['princessFollowerPenalty']
  dragonPosition?: IGameState['dragonPosition']
  fairy?: IGameState['fairy']
  fairyTargets: ReturnType<GameManager['getFairyTargets']>
  currentTile: IGameState['currentTile']
  players: PlayerView[]
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
  /** Признак приватной комнаты; пароль клиенту не отдаётся. */
  isPrivate: boolean
  isPlacingFollower: boolean
  isPlacingFairy: boolean
  scores: IGameState['scores']
  gameIsStarted: boolean
  gridSize: number[]
  completedObjects: IGameState['completedObjects']
  temporaryObjects: IGameState['temporaryObjects']
  lastPlacement: IGameState['lastPlacement']
  availablePlacesTiles: IGameState['availablePlacesTiles']
  playersFollowers: IGameState['playersFollowers']
  /** История действий: полная при снимке, отсутствует при дельте. */
  actionsHistory?: IGameState['actionsHistory']
  /**
   * Дельта истории: только действия с индексом > lastActionIndex получателя.
   * Присутствует вместо `actionsHistory` при инкрементальном обновлении.
   */
  actionsHistoryDelta?: IGameState['actionsHistory']
  /** Индекс последнего действия на сервере (0-based, -1 если действий нет). */
  lastActionIndex: number
  currentPlayer: PlayerView | null
  placedFollowers: IGameState['placedFollowers']
  fieldFollowers: IGameState['fieldFollowers']
  winnerPlayerIds: IGameState['winnerPlayerIds']
  lastUpdate: number
  /** Сессия владельца лобби; после старта партии поле сохраняется для сведений. */
  ownerSessionId: string | null
}

/**
 * Состояние для клиента.
 *
 * `tileHistory` сюда не входит: клиент его нигде не читает, а список растёт
 * с каждым ходом и раздувал бы каждое широковещательное сообщение. История
 * тайлов остаётся в сохранении, где она и нужна.
 *
 * При `options.fromActionIndex` возвращается только дельта — действия с
 * индексом большим, чем переданный, плюс `lastActionIndex`. Без опции
 * возвращается полный снимок с полной `actionsHistory`.
 */
export function formatGameData(
  game: GameManager,
  options?: { fromActionIndex?: number }
): GameData {
  const fromIndex = options?.fromActionIndex
  const lastActionIndex = game.actionsHistory.length - 1
  const base = {
    placingPoint: game.placingPoint,
    tilePlacesStats: game.tilePlacesStats,
    fieldComponents: buildFieldComponents(game.tilePlacesStats),
    tilesCount: game.tilesList.length,
    dragonMove: game.dragonMove,
    princessChoice: game.princessChoice,
    princessFollowerPenalty: game.princessFollowerPenalty,
    dragonPosition: game.dragonPosition,
    fairy: game.fairy,
    fairyTargets: game.getFairyTargets(),
    currentTile: game.currentTile,
    players: game.players.map(toPlayerView),
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
    isPrivate: game.isPrivate,
    isPlacingFollower: game.isPlacingFollower,
    isPlacingFairy: game.isPlacingFairy,
    scores: game.scores,
    gameIsStarted: game.gameIsStarted,
    gridSize: game.gridSize,
    completedObjects: game.completedObjects,
    temporaryObjects: game.temporaryObjects,
    lastPlacement: game.lastPlacement,
    availablePlacesTiles: game.availablePlacesTiles,
    playersFollowers: game.playersFollowers,
    lastActionIndex,
    currentPlayer: game.currentPlayer ? toPlayerView(game.currentPlayer) : null,
    placedFollowers: game.placedFollowers,
    fieldFollowers: game.fieldFollowers,
    winnerPlayerIds: game.winnerPlayerIds,
    lastUpdate: game.lastUpdate,
    ownerSessionId: game.ownerSessionId,
  }

  if (fromIndex !== undefined) {
    return {
      ...base,
      actionsHistoryDelta: game.actionsHistory.slice(fromIndex + 1),
    }
  }

  return {
    ...base,
    actionsHistory: game.actionsHistory,
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
