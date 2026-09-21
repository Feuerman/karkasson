export const PORT = Number(process.env.PORT) || 3001

export const ADMIN_UI_ORIGIN = 'https://admin.socket.io'

// Игра удаляется, если её не обновляли дольше получаса
export const GAME_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000

// Как часто проверять «зависшие» игры
export const STALE_GAMES_CHECK_MS = 10_000

// Пауза перед ходом компьютерного игрока
export const COMPUTER_MOVE_DELAY_MS =
  Number(process.env.COMPUTER_MOVE_DELAY_MS) || 1000

export const firebaseConfig = {
  apiKey: 'AIzaSyDyRbOXPz22xQVZndSmwwXWwfBXXQw-adw',
  authDomain: 'karkassone-a5080.firebaseapp.com',
  projectId: 'karkassone-a5080',
  storageBucket: 'karkassone-a5080.firebasestorage.app',
  messagingSenderId: '142905740344',
  appId: '1:142905740344:web:4d9ea0c2ec278d3d92aacd',
  measurementId: 'G-KYYJTPJXYH',
  databaseURL: 'https://karkassone-a5080-default-rtdb.firebaseio.com/',
}
