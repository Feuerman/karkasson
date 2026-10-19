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
  InternalFailure: 'Что-то пошло не так. Попробуйте повторить действие',
  SaveFailed: 'Не удалось сохранить изменения. Попробуйте повторить действие',
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
} as const

export const GameErrors = {
  NotPlayersTurn: 'Сейчас ход другого игрока — дождитесь своей очереди',
  InvalidTileRotation: 'Недопустимый поворот тайла',
  ResolveExpansionActionFirst: 'Сначала завершите текущее действие дополнения',
  NoTileWaiting: 'Нет тайла, который можно разместить',
  InvalidTilePosition: 'Недопустимая позиция тайла',
  NotPlacingFollower: 'Сейчас нельзя выставлять подданных',
  InvalidFollowerPlacement: 'Недопустимое место для подданного',
  AbbotRequiresMonasteryOrGarden:
    'Аббата можно выставить только на монастырь или сад',
  BigFollowerExpansionDisabled:
    'Дополнение «Большой подданный» не включено в этой партии',
  FollowerNotAllowedOnGarden: 'Подданного нельзя выставлять на сад',
  FollowerPlacementUnavailable: 'Выставление подданных больше недоступно',
  NoAbbotOnBoard: 'У игрока нет аббата на доске',
  InvalidDragonTurn: 'Сейчас нельзя перемещать дракона',
  InvalidDragonDestination: 'Дракон не может оказаться в этом месте',
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
