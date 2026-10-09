export const TEST_IDS = {
  lobbyCreateGame: 'lobby-create-game',
  lobbyRoomSearch: 'lobby-room-search',
  lobbyStartGame: 'lobby-start-game',
  lobbyRoomHeading: 'lobby-room-heading',
  lobbyPrincessDragonStatus: 'lobby-princess-dragon-status',
  createGameModalTitle: 'create-game-modal-title',
  createGameFinalScoring: 'create-game-final-scoring',
  createGamePrincessDragon: 'create-game-princess-dragon',
  createGameSubmit: 'create-game-submit',
  playerSlotCheckbox: 'player-slot-checkbox',
  gameStatsCurrentPlayer: 'game-stats-current-player',
  gameExit: 'game-exit',
  followerPlacementOptions: 'follower-placement-options',
  historyFilter: 'history-filter',
  historyMoveHeader: 'history-move-header',
  historyFinalScoringGroup: 'history-final-scoring-group',
  historyScoreDetails: 'history-score-details',
  historyScoreDetailsTooltip: 'history-score-details-tooltip',
  historyObjectFocus: 'history-object-focus',
  boardCell: 'board-cell',
} as const

export const boardCellTestId = (rowIndex: number, tileIndex: number): string =>
  `${TEST_IDS.boardCell}-${rowIndex}-${tileIndex}`
