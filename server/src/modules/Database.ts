// @ts-nocheck
// @ts-ignore

import { IGameBoard } from './GameManager'

// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, get, push, remove } from 'firebase/database'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyDyRbOXPz22xQVZndSmwwXWwfBXXQw-adw',
  authDomain: 'karkassone-a5080.firebaseapp.com',
  projectId: 'karkassone-a5080',
  storageBucket: 'karkassone-a5080.firebasestorage.app',
  messagingSenderId: '142905740344',
  appId: '1:142905740344:web:4d9ea0c2ec278d3d92aacd',
  measurementId: 'G-KYYJTPJXYH',
  databaseURL: 'https://karkassone-a5080-default-rtdb.firebaseio.com/',
}

class GameDatabase {
  private firebaseDatabase

  constructor() {
    const app = initializeApp(firebaseConfig)
    this.firebaseDatabase = getDatabase(app)
  }

  // Сохранение состояния игры
  async saveGame(gameId: string, gameState: IGameBoard) {
    gameState.lastUpdate = Date.now()
    // Firebase operation
    try {
      set(
        ref(this.firebaseDatabase, `games/${gameId}`),
        JSON.stringify(gameState)
      )
    } catch (error) {
      console.error('Error saving to Firebase:', error)
    }
  }

  // Получение состояния игры
  async getGame(gameId: string): Promise<IGameBoard | null> {
    // Firebase operation
    try {
      const snapshot = await get(ref(this.firebaseDatabase, `games/${gameId}`))
      if (snapshot.exists()) {
        console.log('Firebase game data:', JSON.parse(snapshot.val()))
      } else {
        return null
      }
    } catch (error) {
      console.error('Error reading from Firebase:', error)
    }

    return JSON.parse(result.gameState)
  }

  // Получение всех сохраненных игр
  async getAllGames(): Promise<IGameBoard[]> {
    // Firebase operation
    try {
      const snapshot = await get(ref(this.firebaseDatabase, 'games'))
      if (snapshot.exists()) {
        return Object.values(snapshot.val()).map((result) =>
          typeof result === 'string' ? JSON.parse(result) : result
        )
      }
    } catch (error) {
      console.error('Error reading all games from Firebase:', error)
    }

    return results.map((result) => JSON.parse(result.gameState))
  }

  async saveAllGames(games: IGameBoard[]) {
    try {
      set(ref(this.firebaseDatabase, `games/`), games)
    } catch (error) {
      console.error('Error saving to Firebase:', error)
    }
  }

  // Удаление игры
  async deleteGame(gameId: string) {
    // Firebase operation
    try {
      await remove(ref(this.firebaseDatabase, `games/${gameId}`))
    } catch (error) {
      console.error('Error deleting from Firebase:', error)
    }
  }
}

export const gameDatabase = new GameDatabase()
