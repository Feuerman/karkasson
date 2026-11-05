/**
 * Тексты ошибок, которые видит игрок.
 *
 * Все сообщения из этого файла показываются игроку без изменений, поэтому они
 * должны быть на русском языке и объяснять причину отказа, а не называть
 * внутренние сущности сервера. Внутренние (технические) тексты в этот файл не
 * попадают: их заменяет `CommonErrors.InternalFailure`.
 */

export const CommonErrors = {
  GameNotFound: 'Партия не найдена',
  PlayerNotFoundInGame: 'Игрок не найден в этой партии',
  SessionRequired: 'Сессия не готова. Переподключитесь к серверу',
  InternalFailure: 'Что-то пошло не так. Попробуйте повторить действие',
  SaveFailed: 'Не удалось сохранить изменения. Попробуйте повторить действие',
  InvalidRequest: 'Некорректный запрос. Проверьте данные и повторите',
  TooManyRequests: 'Слишком много запросов. Подождите немного и повторите',
  TooManyConnections: 'Слишком много подключений. Попробуйте позже',
  JoinAttemptsExceeded:
    'Слишком много неудачных попыток входа. Попробуйте позже',
} as const

export const LobbyErrors = {
  AllSlotsTaken: 'Все слоты заняты',
  SlotEditForbidden: 'Недостаточно прав для изменения этого слота',
  OnlyLobbyOwnerCanStart: 'Только создатель лобби может начать игру',
  InvalidFinalScoringOption: 'Некорректный параметр «Финальный подсчёт очков»',
  InvalidInnsAndCathedralsOption:
    'Некорректный параметр дополнения «Таверны и соборы»',
  InvalidRiverOption: 'Некорректный параметр дополнения «Река»',
  InvalidPrincessAndDragonOption:
    'Некорректный параметр дополнения «Принцесса и дракон»',
  StartFailed: 'Не удалось начать игру',
  GameAlreadyStarted: 'Игра уже началась',
  AlreadyJoinedGame: 'Вы уже присоединились к игре',
  TooManyGames: 'Слишком много активных партий на сервере. Попробуйте позже',
  TooManyOwnedLobbies:
    'Вы создали слишком много лобби. Завершите старые партии',
  TooManyAiGames:
    'Слишком много партий с компьютерами на сервере. Попробуйте позже',
  TooManyOwnedAiGames:
    'У вас уже есть партии с компьютерами. Дождитесь их завершения',
  PlayerNameTooLong: 'Имя игрока слишком длинное',
  PlayerNameInvalid: 'Имя игрока содержит недопустимые символы',
  PlayerNameProfanity: 'Имя игрока содержит недопустимые слова',
  PlayerNameTaken: 'Игрок с таким именем уже есть в лобби',
} as const

export const GameErrors = {
  NotPlayersTurn: 'Сейчас ход другого игрока — дождитесь своей очереди',
  InvalidTileRotation: 'Недопустимый поворот тайла',
  ResolveExpansionActionFirst: 'Сначала завершите текущее действие дополнения',
  NoTileWaiting: 'Нет тайла, который можно разместить',
  NotPlacingFollower: 'Сейчас нельзя выставлять подданных',
  InvalidFollowerPlacement: 'Недопустимое место для подданного',
  FollowerPlacementUnavailable: 'Выставление подданных больше недоступно',
  NoAbbotOnBoard: 'У игрока нет аббата на доске',
  InvalidDragonTurn: 'Сейчас нельзя перемещать дракона',
  InvalidDragonDestination: 'Дракон не может оказаться в этом месте',
  NotPlacingFairy: 'Сейчас нельзя перемещать фею',
  InvalidFairyTarget: 'Фея может встать только к своему подданному',
  PrincessChoiceNotPending: 'Принцесса сейчас не ждёт выбора города',
  InvalidPrincessCity: 'Недопустимый город для принцессы',
} as const

/** Внутренние тексты диагностики; игроку не показываются. */
export const SaveErrors = {
  StorageKeyMismatch: 'Game id does not match its storage key',
  SaveMustBeObject: 'Game save must be an object',
  SaveInvalidTile: 'Game save contains an invalid tile',
  SaveInvalidFollowerPool: 'Game save contains an invalid follower pool',
} as const

function toErrorCode(prefix: string, key: string): string {
  return `${prefix}.${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`
}

function buildErrorCodeMap(): Record<string, string> {
  const catalogs: Array<[string, Record<string, string>]> = [
    ['common', CommonErrors],
    ['lobby', LobbyErrors],
    ['game', GameErrors],
  ]
  return Object.fromEntries(
    catalogs.flatMap(([prefix, catalog]) =>
      Object.entries(catalog).map(([key, message]) => [
        message,
        toErrorCode(prefix, key),
      ])
    )
  )
}

/**
 * Стабильные машинные коды для безопасных текстов из каталогов. Клиент может
 * опираться на код, не разбирая русский текст сообщения.
 */
export const ERROR_CODES_BY_MESSAGE: Readonly<Record<string, string>> =
  buildErrorCodeMap()

export function errorCodeForMessage(message: string): string {
  return ERROR_CODES_BY_MESSAGE[message] ?? 'common.internal_failure'
}

/**
 * Ошибка записи партии в хранилище, отличная от сбоя самой логики хода.
 *
 * Различие важно при разборе последствий: при недоступном хранилище партию
 * удалять нельзя — она переживёт восстановление связи, — а сбой логики хода
 * оставляет партию в нерабочем состоянии.
 */
export class GameSaveError extends Error {
  constructor(gameId: string, cause: unknown) {
    super(`Failed to save game ${gameId}`, { cause })
    this.name = 'GameSaveError'
  }
}

/**
 * Отмена изменения партии: состояние откатывается и не сохраняется.
 *
 * Нужна, когда ход нельзя доиграть: например, компьютер начал ход, но игрок
 * отключился — тогда правка отменяется целиком.
 */
export class MutationCancelled extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'MutationCancelled'
  }
}
