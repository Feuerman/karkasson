export const PORT = Number(process.env.PORT) || 3001

export const ADMIN_UI_ORIGIN = 'https://admin.socket.io'

export interface SocketAdminUIOptions {
  auth: {
    type: 'basic'
    username: string
    password: string
  }
  mode: 'development' | 'production'
  readonly: boolean
}

export function getSocketAdminUIOptions(
  environment: NodeJS.ProcessEnv = process.env
): SocketAdminUIOptions | null {
  const username = environment.SOCKET_ADMIN_UI_USERNAME?.trim()
  const password = environment.SOCKET_ADMIN_UI_PASSWORD_HASH?.trim()

  if (!username && !password) return null
  if (!username || !password) {
    throw new Error(
      'SOCKET_ADMIN_UI_USERNAME and SOCKET_ADMIN_UI_PASSWORD_HASH must both be set'
    )
  }

  const readonly = environment.SOCKET_ADMIN_UI_READONLY
  if (readonly && readonly !== 'true' && readonly !== 'false') {
    throw new Error('SOCKET_ADMIN_UI_READONLY must be "true" or "false"')
  }

  return {
    auth: { type: 'basic', username, password },
    mode: environment.NODE_ENV === 'production' ? 'production' : 'development',
    readonly: readonly !== 'false',
  }
}

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
