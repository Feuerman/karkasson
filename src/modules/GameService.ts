import { io, Socket } from 'socket.io-client'

export interface IGameService {
  socket: Socket | null
  gameId: string
  deviceId: string
  connect: () => void
  disconnect: () => void
  createGame: () => Promise<any>
  joinGame: (gameId: string, playerName: string) => Promise<any>
}

class GameService implements IGameService {
  socket: Socket | null
  gameId: string
  deviceId: string
  gamesList: any[] = []
  constructor() {
    this.socket = null
    this.gameId = ''
    this.gamesList = []
    this.deviceId = localStorage.getItem('deviceId') || crypto.randomUUID()
    localStorage.setItem('deviceId', this.deviceId)
  }

  connect() {
    console.log('Attempting to connect to server...')
    if (this.socket?.connected) {
      console.log('Socket already connected, skipping connection')
      return
    }

    this.socket = io('https://karkasson.onrender.com', {
      secure: true,
      rejectUnauthorized: true,
      port: 10000,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      forceNew: false,
    })

    this.socket.on('connect', () => {
      this.socket?.emit('registerDevice', { deviceId: this.deviceId })
    })

    this.socket.on('disconnect', (reason: string) => {
      if (
        reason === 'io server disconnect' ||
        reason === 'io client disconnect'
      ) {
        console.log('Attempting to reconnect after disconnect...')
        this.socket?.connect()
      }
    })

    this.socket.on('connect_error', (error: Error) => {
      console.error('Connection error:', error)
    })

    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      console.log('Attempting to reconnect:', attemptNumber)
    })

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log('Successfully reconnected after', attemptNumber, 'attempts')
    })

    this.socket.on('reconnect_error', (error: Error) => {
      console.error('Reconnection error:', error)
    })

    this.socket.on('reconnect_failed', () => {
      console.error('Failed to reconnect after all attempts')
    })

    this.socket.on('error', (error: Error) => {
      console.error('Server error:', error)
    })
  }

  getGamesList() {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject('Нет соединения с сервером')
      } else {
        this.socket.emit('getGamesList', (response) => {
          if (response.error) {
            reject(response.error)
          } else {
            this.gamesList = response.games
            resolve(response.games)
          }
        })
      }
    })
  }

  createGame() {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject('Нет соединения с сервером')
      } else {
        this.socket?.emit('createGame')
        this.socket?.once('error', (error: Error) => reject(error))
        this.socket?.once(
          'gameCreated',
          ({ gameId, game }: { gameId: string; game: any }) => {
            this.gameId = gameId
            resolve(game)
          }
        )
      }
    })
  }

  addPlayer({ name, index }: { name: string; index: number }) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject('Нет соединения с сервером')
      } else {
        this.socket.emit(
          'addPlayer',
          { gameId: this.gameId, name, index },
          (response) => {
            if (response.error) {
              reject(response.error)
            } else {
              resolve(response)
            }
          }
        )
      }
    })
  }

  startGame() {
    this.socket.emit('startGame', { gameId: this.gameId })
  }

  joinGame(gameId: string, playerName: string) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject('Нет соединения с сервером')
      } else {
        this.socket.emit('joinGame', { gameId, playerName })
        this.socket.once('error', (error: Error) => reject(error))
        this.socket.once('gameUpdated', (game: any) => {
          this.gameId = gameId
          resolve(game)
        })
      }
    })
  }

  rejoinGame(gameId: string) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        console.error('Socket not connected while rejoining game')
        return
      }
      this.socket.emit('rejoinGame', { gameId, deviceId: this.deviceId })
      this.socket.once('error', (error: Error) => reject(error))
      this.socket.once('gameUpdated', (game: any) => {
        this.gameId = gameId
        resolve(game)
      })
    })
  }

  onGameUpdated(callback: (game: any) => void) {
    this.socket?.on('gameUpdated', callback)
  }

  onPlayerDisconnected(callback: () => void) {
    this.socket?.on('playerDisconnected', callback)
  }

  async selectPlacingPoint({
    rowIndex,
    tileIndex,
  }: {
    rowIndex: number
    tileIndex: number
  }) {
    return new Promise((resolve, reject) => {
      this.socket?.emit(
        'selectPlacingPoint',
        { gameId: this.gameId, point: { rowIndex, tileIndex } },
        (response: any) => {
          if (response.error) {
            reject(response.error)
          } else {
            resolve(response)
          }
        }
      )
    })
  }

  async updateCurrentTile(tile: any) {
    return new Promise((resolve, reject) => {
      this.socket?.emit(
        'updateCurrentTile',
        { gameId: this.gameId, tile },
        (response: any) => {
          if (response.error) {
            reject(response.error)
          } else {
            resolve(response)
          }
        }
      )
    })
  }

  placeTile(tile: any, position: { rowIndex: number; tileIndex: number }) {
    return new Promise((resolve, reject) => {
      this.socket?.emit(
        'placeTile',
        { gameId: this.gameId, tile, position },
        (response: any) => {
          if (response.error) {
            reject(response.error)
          } else {
            resolve(response)
          }
        }
      )
    })
  }

  placeFollower(place: { type: string; side?: string }) {
    return new Promise((resolve, reject) => {
      this.socket?.emit(
        'placeFollower',
        { gameId: this.gameId, place },
        (response: any) => {
          if (response.error) {
            reject(response.error)
          } else {
            resolve(response)
          }
        }
      )
    })
  }

  skipFollower() {
    return new Promise((resolve, reject) => {
      this.socket.emit('skipFollower', { gameId: this.gameId }, (response) => {
        console.log('Server response for skip follower:', response)
        if (response.error) {
          console.error('Server error:', response.error)
          reject(response.error)
        } else {
          resolve(response)
        }
      })
    })
  }

  disconnect() {
    console.log('Manual disconnect called. Current gameId:', this.gameId)
    if (this.socket) {
      const gameId = this.gameId
      this.socket.disconnect()
      this.gameId = gameId
    }
  }

  checkAvailablePlacements(position) {
    return new Promise((resolve, reject) => {
      this.socket.emit(
        'checkAvailablePlacements',
        {
          gameId: this.gameId,
          position,
        },
        (response) => {
          if (response.error) {
            reject(response.error)
          } else {
            resolve(response.placements)
          }
        }
      )
    })
  }

  leaveGame () {
    this.socket?.emit('leaveGame', { gameId: this.gameId })
  }
}

export default new GameService()
