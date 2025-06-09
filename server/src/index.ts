// @ts-nocheck
// @ts-ignore

import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { randomUUID } from 'node:crypto'
import { GameManager, type IGameBoard } from './modules/GameManager.ts'
import { Player, PlayerColors } from './modules/types.ts'
import { instrument } from '@socket.io/admin-ui'
import { gameDatabase } from './modules/Database'

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: ['https://admin.socket.io'],
    credentials: true,
  },
})

instrument(io, {
  auth: false,
})

// Хранение состояний игр
const games: Record<string, IGameBoard> = {}
// Хранение соответствия deviceId и socketId
const deviceToSocketMap: Record<string, string> = {}

// Helper function to format game data before sending
function formatGameData(game: IGameBoard) {
  // Create a copy of the game to avoid modifying the original
  const formattedGame = {
    tilePlacesStats: game.tilePlacesStats,
    tilesList: game.tilesList,
    currentTile: game.currentTile,
    players: game.players,
    currentPlayerIndex: game.currentPlayerIndex,
    availableFollowersPlaces: game.availableFollowersPlaces,
    gameIsEnded: game.gameIsEnded,
    moveCounter: game.moveCounter,
    id: game.id,
    isPlacingFollower: game.isPlacingFollower,
    scores: game.scores,
    gameIsStarted: game.gameIsStarted,
    gridSize: game.gridSize,
    completedObjects: game.completedObjects,
    temporaryObjects: game.temporaryObjects,
    lastPlacement: game.lastPlacement,
    availablePlacesTiles: game.availablePlacesTiles,
    tileHistory: game.tileHistory,
    playersFollowers: game.playersFollowers,
    availableFollowersPlaces: game.availableFollowersPlaces,
    actionsHistory: game.actionsHistory,
    currentPlayer: game.currentPlayer,
    placedFollowers: game.placedFollowers,
  }
  
  // Add any additional formatting or data transformation here
  // For example:
  // - Remove sensitive data
  // - Add computed properties
  // - Format dates
  // - Add metadata
  
  return formattedGame
}

// Helper function to handle computer player move
async function handleComputerPlayerMove(game: IGameBoard, gameId: string) {
  console.log('=== Computer Move Start ===')
  console.log('Current game state:', {
    gameId,
    currentPlayer: game.currentPlayer?.id,
    isComputer: !game.currentPlayer?.socketId,
    gameIsEnded: game.gameIsEnded,
    moveCounter: game.moveCounter,
  })

  // Skip if game is ended or it's not computer's turn
  if (
    game.gameIsEnded ||
    !game.currentPlayer ||
    game.currentPlayer.socketId
  ) {
    console.log('Skipping computer move:', {
      gameIsEnded: game.gameIsEnded,
      hasCurrentPlayer: !!game.currentPlayer,
      isComputer: !game.currentPlayer?.socketId,
    })
    return
  }

  // Ensure we have a valid game state
  if (!games[gameId] || games[gameId] !== game) {
    console.error('Invalid game state in handleComputerPlayerMove', {
      gameExists: !!games[gameId],
      gameMatches: games[gameId] === game,
    })
    return
  }

  try {
    // Store current player ID before move
    const currentPlayerId = game.currentPlayer.id
    console.log('Starting computer move for player:', currentPlayerId)

    // Perform the computer move
    await game.autoPlaceTile()

    // Verify the move was successful and game state is still valid
    if (!games[gameId] || games[gameId].gameIsEnded) {
      console.log('Game ended or invalid after computer move')
      io.to(gameId).emit('gameUpdated', formatGameData(games[gameId]))

      if (games[gameId].gameIsEnded) {
        gameDatabase.saveGame(gameId, games[gameId])
      }
      return
    }

    // Emit game update immediately after move
    io.to(gameId).emit('gameUpdated', formatGameData(games[gameId]))

    // Get the next player after the move
    const nextPlayer = games[gameId].getNextPlayer(currentPlayerId)
    console.log('Next player after computer move:', {
      nextPlayerId: nextPlayer?.id,
      isComputer: !nextPlayer?.socketId,
      currentPlayerId: games[gameId].currentPlayer?.id,
    })

    gameDatabase.saveGame(gameId, games[gameId])

    // Check if next player is also computer and game is still active
    if (nextPlayer && !nextPlayer.socketId && !games[gameId].gameIsEnded) {
      console.log('Scheduling next computer move')
      // Add a small delay before next computer move to prevent rapid moves
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await handleComputerPlayerMove(games[gameId], gameId)
    } else {
      console.log('No more computer moves needed')
    }
  } catch (error) {
    console.error('Error in handleComputerPlayerMove:', error)
    // Emit error to clients if needed
    io.to(gameId).emit('gameError', {
      message: 'Error processing computer move',
    })
  }
  console.log('=== Computer Move End ===')
}

// Загрузка сохраненных игр при запуске сервера
async function loadSavedGames() {
  console.log('Loading saved games...')
  const savedGames = await gameDatabase.getAllGames()

  savedGames.forEach(savedGame => {
    let game = {}
    // Создаем новый экземпляр GameManager для каждой сохраненной игры
    if (!savedGame.gameIsEnded) {
      game = new GameManager({ players: savedGame.players })
    }
    // Копируем все свойства из сохраненной игры
    Object.assign(game, savedGame)
    // Сохраняем игру в памяти
    games[savedGame.id] = game

    if (!game.gameIsEnded && game.players.every((p) => !p.socketId && !p.deviceId)) {
      setTimeout(() => {
        handleComputerPlayerMove(game, savedGame.id)
      }, 1000)
    }
  })

  console.log(`Loaded ${savedGames.length} saved games`)
}

function createAndStartGame() {
  const gameId = randomUUID()
  io.emit('createGame', { gameId })
  io.emit('startGame', { gameId })
}

createAndStartGame()

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  // Логируем все входящие события для отладки
  socket.onAny((eventName, ...args) => {
    console.log(`Received event "${eventName}":`, args)
  })

  // Обработка первого подключения с deviceId
  socket.on('registerDevice', ({ deviceId }) => {
    console.log('Device registered:', deviceId, 'Socket:', socket.id)
    deviceToSocketMap[deviceId] = socket.id
  })

  socket.on('disconnect', (reason) => {
    // Находим deviceId для этого socket.id
    const deviceId = Object.entries(deviceToSocketMap).find(
      ([_, sid]) => sid === socket.id
    )?.[0]

    // Даем шанс на реконнект только если это не явное отключение
    if (reason === 'transport close' || reason === 'ping timeout') {
      // Найти игры, в которых участвовал игрок
      for (const [gameId, game] of Object.entries(games)) {
        const playerIds = game.players.filter((p) => p.socketId === socket.id)
        if (playerIds.length > 0) {
          if (game.gameIsStarted) {
            socket.to(gameId).emit('playerTemporaryDisconnected', {
              deviceId,
              playerIds,
            })

            game.players = game.players.map((p) => {
              if (p.socketId === socket.id) {
                p.socketId = null
                p.deviceId = deviceId
              }
              return p
            })

            // Сохраняем состояние игры при отключении игрока
            gameDatabase.saveGame(gameId, game)

            // Обновляем список игроков в игре
            io.to(gameId).emit('gameUpdated', formatGameData(game))
          } else {
            game.players = game.players.map((p) => {
              if (p.socketId === socket.id) {
                p.socketId = null
                p.deviceId = null
              }
              return p
            })

            // Обновляем список игроков в игре
            io.to(gameId).emit('gameUpdated', formatGameData(game))
          }

          return
        }
      }
    } else {
      // Для явного отключения сразу удаляем игру
      for (const [gameId, game] of Object.entries(games)) {
        if (game.gameIsStarted) {
          if (game.players.some((p) => p.socketId === socket.id)) {
            delete games[gameId]
            gameDatabase.deleteGame(gameId)
            io.to(gameId).emit('gameDeleted')
          }
        } else {
          if (
            game.players.some((p) => p.socketId && p.socketId !== socket.id)
          ) {
            game.players = game.players.map((p) => {
              if (p.socketId === socket.id) {
                p.socketId = null
                p.deviceId = null
              }
              return p
            })

            // Обновляем список игроков в игре
            io.to(gameId).emit('gameUpdated', formatGameData(game))
          } else {
            delete games[gameId]
            gameDatabase.deleteGame(gameId)
            io.to(gameId).emit('gameDeleted')
            io.emit('updateGamesList', Object.values(games))
          }
        }
      }
    }
  })

  // Переподключение к игре
  socket.on('rejoinGame', ({ gameId, deviceId }) => {
    const game = games[gameId]
    if (!game) {
      socket.emit('error', 'Game not found')
      return
    }

    // Найти игроков по deviceId
    const players = game.players.filter((p) => {
      return p.deviceId === deviceId
    })

    if (players.length > 0) {
      // Обновляем socketId для всех найденных игроков
      game.players.forEach((player) => {
        if (player.deviceId === deviceId) {
          player.socketId = socket.id
          if (player.id === game.currentPlayer?.id) {
            game.currentPlayer.socketId = socket.id
          }
        }
      })
      socket.join(gameId)
      io.to(gameId).emit('gameUpdated', formatGameData(game))
    } else {
      socket.emit('error', 'Player not found in game')
    }

    if (game.gameIsStarted) {
      const allPlayersConnected = game.players.every((p) => p.socketId !== null || !p.deviceId)
      const isComputerMove = !game.currentPlayer?.socketId && !game.currentPlayer?.deviceId

      console.log(allPlayersConnected, 'allPlayersConnected')
      console.log(isComputerMove, 'isComputerMove')
      console.log(game.players, 'game.players')
      if (allPlayersConnected && isComputerMove) {
        handleComputerPlayerMove(game, gameId)
      }
    }
  })

  function getPlayerColor(index) {
    return PlayerColors[index + 1]
  }

  socket.on('getGamesList', async (callback) => {
    const gamesList = Object.values(games)
    // Добавляем сохраненные игры, которых нет в памяти
    const savedGames = await gameDatabase.getAllGames()
    const mergedGames = [...gamesList]

    savedGames.forEach(savedGame => {
      if (!gamesList.find(g => g.id === savedGame.id)) {
        mergedGames.push(savedGame)
      }
    })

    callback({ games: mergedGames })
  })

  // Создание новой игры
  socket.on('createGame', () => {
    const gameId = Math.random().toString(36).substring(7)

    games[gameId] = {
      id: gameId,
      players: [...new Array(4)].map((_, i) => {
        return {
          id: i + 1,
          socketId: null,
          deviceId: null,
          name: 'Player ' + (i + 1),
          color: getPlayerColor(i),
          followers: 7,
          score: 0,
        }
      }) as Player[],
    }

    socket.join(gameId)
    socket.emit('gameCreated', { gameId, game: games[gameId] })
  })

  socket.on('leaveGame', ({ gameId }) => {
    const game = games[gameId]
    if (!game) {
      socket.emit('error', 'Game not found')
      return
    }

    if (!game.gameIsStarted) {
      game.players = game.players.map((p) => {
        if (p.socketId === socket.id) {
          p.socketId = null
          p.deviceId = null
        }
        return p
      })
    }

    socket.leave(gameId)
    io.to(gameId).emit('gameUpdated', formatGameData(game))
  })

  socket.on('addPlayer', ({ gameId, name, index }) => {
    const deviceId = Object.entries(deviceToSocketMap).find(
      ([_, sid]) => sid === socket.id
    )?.[0]
    const game = games[gameId]
    game.players[index].name = name
    game.players[index].socketId = socket.id
    game.players[index].deviceId = deviceId
    io.to(gameId).emit('gameUpdated', formatGameData(game))
  })

  socket.on('startGame', ({ gameId }) => {
    const game = games[gameId]
    const newGame = new GameManager({ players: game.players })
    newGame.id = gameId

    games[gameId] = newGame
    io.to(gameId).emit('gameUpdated', formatGameData(newGame))

    if (game.players?.every((p) => !p.socketId && !p.deviceId)) {
      handleComputerPlayerMove(newGame, gameId)
    }
  })

  // Присоединение к игре
  socket.on('joinGame', ({ gameId }) => {
    const game = games[gameId]
    if (!game) {
      socket.emit('error', 'Game not found')
      return
    }

    if (game.players?.every((p) => p.socketId)) {
      socket.emit('error', 'Game is full')
      return
    }

    socket.join(gameId)
    io.to(gameId).emit('gameUpdated', formatGameData(game))
  })

  socket.on('selectPlacingPoint', ({ gameId, point }, callback) => {
    const game = games[gameId]
    if (!game) {
      callback && callback({ error: 'Game not found' })
      return
    }

    const playerIndexes = game.players.reduce((acc, player, index) => {
      if (player.socketId === socket.id) {
        acc.push(index)
      }

      return acc
    }, [])
    if (playerIndexes.every((index) => index !== game.currentPlayerIndex)) {
      callback && callback({ error: "Not player's turn" })
      return
    }

    game.placingPoint = { rowIndex: point.rowIndex, tileIndex: point.tileIndex }
    io.to(gameId).emit('gameUpdated', formatGameData(game))

    callback && callback({ success: true, game })
  })

  socket.on('updateCurrentTile', ({ gameId, tile }, callback) => {
    const game = games[gameId]
    if (!game) {
      callback && callback({ error: 'Game not found' })
      return
    }

    const playerIndexes = game.players.reduce((acc, player, index) => {
      if (player.socketId === socket.id) {
        acc.push(index)
      }

      return acc
    }, [])
    if (playerIndexes.every((index) => index !== game.currentPlayerIndex)) {
      callback && callback({ error: "Not player's turn" })
      return
    }

    game.currentTile = tile
    io.to(gameId).emit('gameUpdated', formatGameData(game))

    callback && callback({ success: true, game })
  })

  // Обработка хода игрока
  socket.on('placeTile', ({ gameId, tile, position }, callback) => {
    console.log('=== Player Place Tile Start ===')
    console.log('Place tile request:', {
      gameId,
      tileId: tile.id,
      position,
      playerId: socket.id,
    })

    const game = games[gameId]
    if (!game) {
      console.error('Game not found:', gameId)
      callback && callback({ error: 'Game not found' })
      return
    }

    const playerIndexes = game.players.reduce((acc, player, index) => {
      if (player.socketId === socket.id) {
        acc.push(index)
      }
      return acc
    }, [])

    console.log('Player validation:', {
      playerIndexes,
      currentPlayerIndex: game.currentPlayerIndex,
      isValidTurn: !playerIndexes.every(
        (index) => index !== game.currentPlayerIndex
      ),
    })

    if (playerIndexes.every((index) => index !== game.currentPlayerIndex)) {
      callback && callback({ error: "Not player's turn" })
      return
    }

    try {
      // Сохраняем состояние игры перед ходом игрока
      gameDatabase.saveGame(gameId, game)

      const isValidMove = game.placeTile(
        tile,
        position.rowIndex,
        position.tileIndex
      )
      if (!isValidMove) {
        throw new Error('Невозможно разместить тайл на данной позиции')
      } else {
        console.log('Tile placed successfully:', {
          tileId: tile.id,
          position,
          currentPlayer: game.currentPlayer?.id,
        })

        io.to(gameId).emit('gameUpdated', formatGameData(game))
        callback && callback({ success: true, game })

        // Get the next player after the move
        const nextPlayer = game.getNextPlayer(game.currentPlayer.id)
        console.log('Next player after tile placement:', {
          nextPlayerId: nextPlayer?.id,
          isComputer: !nextPlayer?.socketId,
          currentPlayerId: game.currentPlayer?.id,
        })

        // Check if next player is a computer player
        if (nextPlayer && !nextPlayer.socketId || !game.currentPlayer.socketId) {
          console.log('Scheduling computer move after player tile placement')
          setTimeout(() => handleComputerPlayerMove(game, gameId), 1000)
        }
      }
    } catch (error) {
      console.error('Error placing tile:', error)
      callback && callback({ error: error.message || error })
    }
    console.log('=== Player Place Tile End ===')
  })

  // Размещение подданного
  socket.on('placeFollower', ({ gameId, place }, callback) => {
    console.log('=== Player Place Follower Start ===')
    console.log('Place follower request:', {
      gameId,
      place,
      playerId: socket.id,
    })

    const game = games[gameId]
    if (!game) {
      console.error('Game not found:', gameId)
      callback && callback({ error: 'Game not found' })
      return
    }

    const playerIndexes = game.players.reduce((acc, player, index) => {
      if (player.socketId === socket.id) {
        acc.push(index)
      }
      return acc
    }, [])

    console.log('Player validation:', {
      playerIndexes,
      currentPlayerIndex: game.currentPlayerIndex,
      isValidTurn: !playerIndexes.every(
        (index) => index !== game.currentPlayerIndex
      ),
    })

    if (playerIndexes.every((index) => index !== game.currentPlayerIndex)) {
      callback && callback({ error: "Not player's turn" })
      return
    }

    try {
      // Сохраняем состояние игры перед ходом игрока
      gameDatabase.saveGame(gameId, game)

      game.placeFollower(place)
      console.log('Follower placed successfully:', {
        place,
        currentPlayer: game.currentPlayer?.id,
      })

      io.to(gameId).emit('gameUpdated', formatGameData(game))
      callback && callback({ success: true, game })

      // Get the next player after the move
      const nextPlayer = game.getNextPlayer(game.currentPlayer.id)
      console.log('Next player after follower placement:', {
        nextPlayerId: nextPlayer?.id,
        isComputer: !nextPlayer?.socketId,
        currentPlayerId: game.currentPlayer?.id,
      })

      // Check if next player is a computer player
      if (nextPlayer && !nextPlayer.socketId || !game.currentPlayer.socketId) {
        console.log('Scheduling computer move after player follower placement')
        setTimeout(() => handleComputerPlayerMove(game, gameId), 1000)
      }
    } catch (error) {
      console.error('Error placing follower:', error)
      callback && callback({ error })
    }
    console.log('=== Player Place Follower End ===')
  })

  // Добавляем новый обработчик для проверки доступных мест размещения подданных
  socket.on('checkAvailablePlacements', ({ gameId, position }, callback) => {
    const game = games.get(gameId)
    if (!game) {
      console.error('Game not found:', gameId)
      callback({ error: 'Game not found' })
      return
    }

    const { row, col } = position
    const tile = game.grid[row][col]
    if (!tile) {
      callback({ error: 'Tile not found' })
      return
    }

    const availablePlacements: { type: string; side?: string }[] = []

    // Проверяем дороги
    Object.entries(tile.sides).forEach(([side, type]) => {
      if (type === 'road') {
        const road = game.temporaryObjects.roads.find((r) =>
          r.points.some(
            (p) => p.row === row && p.col === col && p.side === side
          )
        )

        if (road && (!road.followers || road.followers.length === 0)) {
          availablePlacements.push({ type: 'road', side })
        }
      } else if (type === 'city') {
        const city = game.temporaryObjects.cities.find((c) =>
          c.points.some(
            (p) => p.row === row && p.col === col && p.side === side
          )
        )

        if (city && (!city.followers || city.followers.length === 0)) {
          availablePlacements.push({ type: 'city', side })
        }
      }
    })

    // Проверяем монастырь
    if (tile.isMonastery) {
      const monastery = game.temporaryObjects.monasteries.find(
        (m) => m.position.row === row && m.position.col === col
      )

      if (
        monastery &&
        (!monastery.followers || monastery.followers.length === 0)
      ) {
        availablePlacements.push({ type: 'monastery', side: 'center' })
      }
    }

    callback({ placements: availablePlacements })
  })

  // Пропуск размещения подданного
  socket.on('skipFollower', ({ gameId }, callback) => {
    console.log('=== Player Skip Follower Start ===')
    console.log('Skip follower request:', {
      gameId,
      playerId: socket.id,
    })

    const game = games[gameId]
    if (!game) {
      callback && callback({ error: 'Game not found' })
      return
    }

    const playerIndexes = game.players.reduce((acc, player, index) => {
      if (player.socketId === socket.id) {
        acc.push(index)
      }
      return acc
    }, [])

    console.log('Player validation:', {
      playerIndexes,
      currentPlayerIndex: game.currentPlayerIndex,
      isValidTurn: !playerIndexes.every(
        (index) => index !== game.currentPlayerIndex
      ),
    })

    if (playerIndexes.every((index) => index !== game.currentPlayerIndex)) {
      callback && callback({ error: "Not player's turn" })
      return
    }

    try {
      // Сохраняем состояние игры перед ходом игрока
      gameDatabase.saveGame(gameId, game)

      game.skipFollower()
      console.log('Follower skipped successfully:', {
        currentPlayer: game.currentPlayer?.id,
      })

      io.to(gameId).emit('gameUpdated', formatGameData(game))
      callback && callback({ success: true, game })

      // Get the next player after the move
      const nextPlayer = game.getNextPlayer(game.currentPlayer.id)
      console.log('Next player after follower skip:', {
        nextPlayerId: nextPlayer?.id,
        isComputer: !nextPlayer?.socketId,
        currentPlayerId: game.currentPlayer?.id,
      })

      // Check if next player is a computer player
      if (nextPlayer && !nextPlayer.socketId || !game.currentPlayer.socketId) {
        console.log('Scheduling computer move after player follower skip')
        setTimeout(() => handleComputerPlayerMove(game, gameId), 1000)
      }
    } catch (error) {
      console.error('Error skipping follower:', error)
      callback && callback({ error: 'Error processing skip follower:', error })
    }
    console.log('=== Player Skip Follower End ===')
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)

  // Загружаем сохраненные игры
  loadSavedGames()
})
