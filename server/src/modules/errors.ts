export const CommonErrors = {
  GameNotFound: 'Game not found',
  PlayerNotFoundInGame: 'Player not found in game',
} as const

export const LobbyErrors = {
  AllSlotsTaken: 'Все слоты заняты',
  SlotEditForbidden: 'Недостаточно прав для изменения этого слота',
  OnlyLobbyOwnerCanStart: 'Только создатель лобби может начать игру',
} as const

export const GameErrors = {
  NotPlayersTurn: "Not player's turn",
  InvalidTileRotation: 'Invalid tile rotation',
  ResolveExpansionActionFirst: 'Resolve the expansion action first',
} as const

export const SaveErrors = {
  StorageKeyMismatch: 'Game id does not match its storage key',
  SaveMustBeObject: 'Game save must be an object',
  SaveInvalidTile: 'Game save contains an invalid tile',
  SaveInvalidFollowerPool: 'Game save contains an invalid follower pool',
} as const
