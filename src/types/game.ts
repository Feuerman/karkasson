export interface IGameBoard {
    gridSize: number
    gameIsStarted: boolean
    gameIsEnded: boolean
    tilesList: any[]
    isMyTurn: boolean
    isPlacingFollower: boolean
    tilePlacesStats: Record<number, Record<number, any>>
    placedFollowers: any[]
    lastPlacement: {
      rowIndex: number
      tileIndex: number
    }
    currentPlayer: {
      socketId: string
    }
  }
  
  export interface IGame {
    id: string
    gameIsStarted: boolean
    players: any[]
    currentPlayer: {
      socketId: string
    }
    placingPoint?: {
      rowIndex: number
      tileIndex: number
    }
    currentTile?: {
      id: string
      rotation: number
      sides: Record<string, any>
    }
  }
  
  export interface ITile {
    id: string
    rotation: number
    sides: Record<string, any>
    followers: any[]
    imgUrl: string
    name: string
    description: string
  } 