export const CommonErrors = {
  GameNotFound: 'Game not found',
  PlayerNotFoundInGame: 'Player not found in game',
} as const

export const LobbyErrors = {
  AllSlotsTaken: 'Все слоты заняты',
  SlotEditForbidden: 'Недостаточно прав для изменения этого слота',
  OnlyLobbyOwnerCanStart: 'Только создатель лобби может начать игру',
  InvalidFinalScoringOption: 'Invalid final scoring option',
  InvalidInnsAndCathedralsOption: 'Invalid Inns and Cathedrals option',
  InvalidRiverOption: 'Invalid River option',
  InvalidPrincessAndDragonOption: 'Invalid Princess and Dragon option',
  StartFailed: 'Не удалось начать игру',
} as const

export const GameErrors = {
  NotPlayersTurn: "Not player's turn",
  InvalidTileRotation: 'Invalid tile rotation',
  ResolveExpansionActionFirst: 'Resolve the expansion action first',
  NoTileWaiting: 'No tile is waiting to be placed',
  InvalidTilePosition: 'Invalid tile position',
  NotPlacingFollower: 'Followers are not being placed right now',
  InvalidFollowerPlacement: 'Invalid follower placement',
  AbbotRequiresMonasteryOrGarden:
    'An abbot can only be placed on a monastery or garden',
  BigFollowerExpansionDisabled: 'The big follower expansion is not enabled',
  FollowerNotAllowedOnGarden: 'A follower cannot be placed on a garden',
  FollowerPlacementUnavailable: 'Follower placement is no longer available',
  NoAbbotOnBoard: 'У игрока нет аббата на доске',
  InvalidDragonTurn: 'Invalid dragon move turn',
  InvalidDragonDestination: 'Invalid dragon destination',
  PrincessChoiceNotPending: 'Princess choice is not pending',
  InvalidPrincessCity: 'Invalid princess city',
} as const

export const SaveErrors = {
  StorageKeyMismatch: 'Game id does not match its storage key',
  SaveMustBeObject: 'Game save must be an object',
  SaveInvalidTile: 'Game save contains an invalid tile',
  SaveInvalidFollowerPool: 'Game save contains an invalid follower pool',
} as const
