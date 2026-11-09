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
  NotEnoughPlayers: 'Для начала игры нужно минимум два игрока',
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
  PasswordRequired: 'Эта комната приватная — нужен пароль',
  InvalidPassword: 'Неверный пароль комнаты',
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

/**
 * Английские переводы пользовательских ошибок из каталогов.
 * Ключ — русский текст из CommonErrors / LobbyErrors / GameErrors,
 * значение — английский эквивалент. Клиент имеет собственные переводы и
 * предпочитает машинный код, поэтому это преимущественно страховка для
 * сообщений, которые сервер отдаёт без кода.
 */
export const ERROR_MESSAGES_EN: Readonly<Record<string, string>> = {
  [CommonErrors.GameNotFound]: 'Game not found',
  [CommonErrors.PlayerNotFoundInGame]: 'Player not found in this game',
  [CommonErrors.SessionRequired]:
    'Session is not ready. Reconnect to the server',
  [CommonErrors.InternalFailure]: 'Something went wrong. Try again',
  [CommonErrors.SaveFailed]: 'Failed to save changes. Try again',
  [CommonErrors.InvalidRequest]:
    'Invalid request. Check the data and try again',
  [CommonErrors.TooManyRequests]:
    'Too many requests. Wait a moment and try again',
  [CommonErrors.TooManyConnections]: 'Too many connections. Try again later',
  [CommonErrors.JoinAttemptsExceeded]:
    'Too many failed join attempts. Try again later',
  [LobbyErrors.AllSlotsTaken]: 'All slots are taken',
  [LobbyErrors.SlotEditForbidden]: 'Not enough rights to change this slot',
  [LobbyErrors.OnlyLobbyOwnerCanStart]:
    'Only the lobby creator can start the game',
  [LobbyErrors.InvalidFinalScoringOption]: 'Invalid "Final scoring" option',
  [LobbyErrors.InvalidInnsAndCathedralsOption]:
    'Invalid "Inns and Cathedrals" expansion option',
  [LobbyErrors.InvalidRiverOption]: 'Invalid "River" expansion option',
  [LobbyErrors.InvalidPrincessAndDragonOption]:
    'Invalid "Princess and the Dragon" expansion option',
  [LobbyErrors.StartFailed]: 'Failed to start the game',
  [LobbyErrors.NotEnoughPlayers]:
    'At least two players are required to start the game',
  [LobbyErrors.GameAlreadyStarted]: 'The game has already started',
  [LobbyErrors.AlreadyJoinedGame]: 'You have already joined the game',
  [LobbyErrors.TooManyGames]:
    'Too many active games on the server. Try again later',
  [LobbyErrors.TooManyOwnedLobbies]:
    'You have created too many lobbies. Finish old games',
  [LobbyErrors.TooManyAiGames]:
    'Too many computer games on the server. Try again later',
  [LobbyErrors.TooManyOwnedAiGames]:
    'You already have computer games. Wait for them to finish',
  [LobbyErrors.PlayerNameTooLong]: 'Player name is too long',
  [LobbyErrors.PlayerNameInvalid]: 'Player name contains invalid characters',
  [LobbyErrors.PlayerNameProfanity]: 'Player name contains prohibited words',
  [LobbyErrors.PlayerNameTaken]:
    'A player with this name is already in the lobby',
  [LobbyErrors.PasswordRequired]: 'This room is private — password required',
  [LobbyErrors.InvalidPassword]: 'Invalid room password',
  [GameErrors.NotPlayersTurn]:
    "It's another player's turn — wait for your turn",
  [GameErrors.InvalidTileRotation]: 'Invalid tile rotation',
  [GameErrors.ResolveExpansionActionFirst]:
    'Finish the current expansion action first',
  [GameErrors.NoTileWaiting]: 'There is no tile to place',
  [GameErrors.NotPlacingFollower]: 'You cannot place followers now',
  [GameErrors.InvalidFollowerPlacement]: 'Invalid follower placement',
  [GameErrors.FollowerPlacementUnavailable]:
    'Placing followers is no longer available',
  [GameErrors.NoAbbotOnBoard]: 'The player has no abbot on the board',
  [GameErrors.InvalidDragonTurn]: 'You cannot move the dragon now',
  [GameErrors.InvalidDragonDestination]: 'The dragon cannot be moved there',
  [GameErrors.NotPlacingFairy]: 'You cannot move the fairy now',
  [GameErrors.InvalidFairyTarget]:
    'The fairy can only stand next to your own follower',
  [GameErrors.PrincessChoiceNotPending]:
    "The princess isn't waiting for a city choice",
  [GameErrors.InvalidPrincessCity]: 'Invalid city for the princess',
} as const

/**
 * Переводит текст ошибки на язык игрока, если известен перевод.
 * Локаль 'en' включает английский, иначе возвращается исходный русский текст.
 */
export function translateErrorMessage(
  message: string,
  locale?: string
): string {
  if (locale === 'en') {
    return ERROR_MESSAGES_EN[message] ?? message
  }
  return message
}

function toErrorCode(prefix: string, key: string): string {
  const snake = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
  return `${prefix}.${snake}`
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
