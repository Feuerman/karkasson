export const TEST_IDS = {
  lobbyCreateGame: 'lobby-create-game',
  lobbyRoomSearch: 'lobby-room-search',
  lobbyStartGame: 'lobby-start-game',
  lobbyRoomHeading: 'lobby-room-heading',
  lobbyPrincessDragonStatus: 'lobby-princess-dragon-status',
  createGameModalTitle: 'create-game-modal-title',
  createGameFinalScoring: 'create-game-final-scoring',
  createGamePrincessDragon: 'create-game-princess-dragon',
  createGameTestModeNote: 'create-game-test-mode-note',
  createGameSubmit: 'create-game-submit',
  playerSlotCheckbox: 'player-slot-checkbox',
  gameStatsCurrentPlayer: 'game-stats-current-player',
  gameExit: 'game-exit',
  followerPlacementOptions: 'follower-placement-options',
  boardCell: 'board-cell',
} as const

export const boardCellTestId = (rowIndex: number, tileIndex: number): string =>
  `${TEST_IDS.boardCell}-${rowIndex}-${tileIndex}`
