/**
 * Сериализуемое состояние партии.
 *
 * Здесь перечислены все поля, которые переживают сохранение: они попадают и в
 * снимок для отката, и в запись хранилища, и в широковещательное состояние.
 * Перечисление сделано явно, а не размазано по `Object.assign`, потому что
 * иначе в сохранение незаметно просачиваются приватные runtime-флаги класса
 * (например, `isPlacingStartTile`), которые не имеют отношения к состоянию
 * партии и не должны переживать перезапуск сервера.
 */

import type {
  AvailableFollowerPlace,
  AvailablePlace,
  CompletedObjects,
  DragonMoveState,
  DragonPosition,
  FollowerCount,
  GameRules,
  GridTile,
  PlacedFollower,
  Player,
  PlayerId,
  PrincessChoiceState,
  Scores,
  TemporaryObjects,
  Tile,
  TilePlacesStats,
} from './types'
import type { GameAction } from './gameActions'

/**
 * Данные партии без методов: ровно то, что хранится в Firebase и
 * восстанавливается обратно в `GameManager`.
 */
export interface IGameState {
  id?: string
  roomCode?: string
  gridSize: number[]
  gameIsStarted: boolean
  gameIsEnded: boolean
  finalScoringEnabled: boolean
  rules: GameRules
  tilesList: Tile[]
  currentTile: GridTile | null
  players: Player[]
  currentPlayer: Player | null
  currentPlayerIndex: number
  playersFollowers: Record<PlayerId, FollowerCount>
  temporaryObjects: TemporaryObjects
  completedObjects: CompletedObjects
  scores: Scores
  /** Игроки с максимальным счётом; непусто только при gameIsEnded. */
  winnerPlayerIds: PlayerId[]
  availableFollowersPlaces: AvailableFollowerPlace[]
  isPlacingFollower: boolean
  placedFollowers: PlacedFollower[]
  tilePlacesStats: TilePlacesStats
  lastPlacement: { rowIndex?: number; tileIndex?: number }
  availablePlacesTiles: AvailablePlace[]
  tileHistory: Tile[]
  actionsHistory: GameAction[]
  moveCounter: number
  lastUpdate: number
  placingPoint?: { rowIndex: number; tileIndex: number }
  dragonMove?: DragonMoveState
  princessChoice?: PrincessChoiceState
  /**
   * Штраф принцессы: её способность сработала, поэтому на этот тайл
   * подданного выставить нельзя. Действует до конца хода и переживает
   * сохранение, иначе после перезапуска игрок смог бы обойти запрет.
   */
  princessFollowerPenalty?: boolean
  dragonPosition?: DragonPosition
  /**
   * Переход между ходами: вулкан поставлен, дракон начнёт ходить в конце хода
   * игрока. Флаг живёт дольше одного хода, поэтому обязан пережить
   * сохранение — иначе после перезапуска дракон не проснётся.
   */
  pendingDragonMovement: boolean
}

/**
 * Поля состояния, которые переживают сохранение. Список используется и при
 * снятии снимка, и при сборке сохраняемого объекта, поэтому попасть в
 * сохранение может только то, что здесь перечислено.
 */
export const SERIALIZED_GAME_FIELDS = [
  'id',
  'roomCode',
  'gridSize',
  'gameIsStarted',
  'gameIsEnded',
  'finalScoringEnabled',
  'rules',
  'tilesList',
  'currentTile',
  'players',
  'currentPlayer',
  'currentPlayerIndex',
  'playersFollowers',
  'temporaryObjects',
  'completedObjects',
  'scores',
  'winnerPlayerIds',
  'availableFollowersPlaces',
  'isPlacingFollower',
  'placedFollowers',
  'tilePlacesStats',
  'lastPlacement',
  'availablePlacesTiles',
  'tileHistory',
  'actionsHistory',
  'moveCounter',
  'lastUpdate',
  'placingPoint',
  'dragonMove',
  'princessChoice',
  'princessFollowerPenalty',
  'dragonPosition',
  'pendingDragonMovement',
] as const satisfies readonly (keyof IGameState)[]

/**
 * Снимок состояния партии: новый объект с теми же полями, что и `IGameState`.
 *
 * Принимает и живую партию, и уже проверенную запись из хранилища
 * (`Record<string, unknown>`), поэтому одно и то же поле списка используется
 * при откате хода и при разборе сохранения. Приведение единственное и
 * локальное: проверки формы записи выполняются в `gameSave.ts` до вызова.
 *
 * Функция ничего не копирует глубоко — глубокое копирование делает вызывающий
 * (см. `cloneGameState`), потому что снимок для отката и снимок для записи
 * нужны разной глубины.
 */
export function pickGameState(
  source: IGameState | Record<string, unknown>
): IGameState {
  const state: Partial<IGameState> = {}
  for (const field of SERIALIZED_GAME_FIELDS) {
    Object.assign(state, { [field]: source[field] })
  }
  return state as IGameState
}

/**
 * Поля состояния, которые меняет ход.
 *
 * Снимок для отката берётся перед каждой изменяющей командой, поэтому в нём
 * нет колоды и истории тайлов: ход их не меняет, а копировать их дороже всего.
 * Остальное состояние меняется и должно вернуться к прежнему виду.
 */
export const ROLLBACK_GAME_FIELDS = [
  'gameIsEnded',
  'currentTile',
  'playersFollowers',
  'temporaryObjects',
  'completedObjects',
  'scores',
  'winnerPlayerIds',
  'availableFollowersPlaces',
  'isPlacingFollower',
  'placedFollowers',
  'tilePlacesStats',
  'lastPlacement',
  'availablePlacesTiles',
  'actionsHistory',
  'moveCounter',
  'currentPlayer',
  'currentPlayerIndex',
  'placingPoint',
  'dragonMove',
  'princessChoice',
  'princessFollowerPenalty',
  'dragonPosition',
  'pendingDragonMovement',
] as const satisfies readonly (keyof IGameState)[]

/**
 * Снимок состояния для отката: только те поля, которые меняет ход.
 */
export function pickRollbackState(
  source: IGameState | Record<string, unknown>
): Partial<IGameState> {
  const state: Partial<IGameState> = {}
  for (const field of ROLLBACK_GAME_FIELDS) {
    Object.assign(state, { [field]: source[field] })
  }
  return state
}

/**
 * Глубокая копия снимка для отката.
 */
export function cloneRollbackState(
  state: Partial<IGameState>
): Partial<IGameState> {
  return structuredClone(state)
}

/**
 * Глубокая копия состояния партии.
 *
 * `structuredClone` копирует всё, включая ссылки между полями, поэтому
 * `currentPlayer` и соответствующий элемент `players` остаётся одним и тем же
 * объектом, как и в живой партии. Это важно: код ходов меняет их оба.
 */
export function cloneGameState<T extends IGameState>(state: T): T {
  return structuredClone(state)
}
