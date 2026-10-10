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

// Время на восстановление соединения всеми реальными игроками партии.
export const PLAYER_RECONNECT_TIMEOUT_MS = 15 * 60 * 1000

export interface FirebaseConfig {
  apiKey: string
  databaseURL: string
  authDomain?: string
  projectId?: string
  storageBucket?: string
  messagingSenderId?: string
  appId?: string
  measurementId?: string
}

function readEnv(
  environment: NodeJS.ProcessEnv,
  name: string
): string | undefined {
  const value = environment[name]?.trim()
  return value ? value : undefined
}

function requireEnv(environment: NodeJS.ProcessEnv, name: string): string {
  const value = readEnv(environment, name)
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`)
  }
  return value
}

/**
 * Конфигурация Firebase Realtime Database. Значения приходят из окружения:
 * обязательны FIREBASE_API_KEY и FIREBASE_DATABASE_URL, остальные необязательны
 * и попадают в конфиг только когда заданы. Нужен только production-серверу,
 * в разработке и тестах работает in-memory хранилище.
 */
export function getFirebaseConfig(
  environment: NodeJS.ProcessEnv = process.env
): FirebaseConfig {
  const config: FirebaseConfig = {
    apiKey: requireEnv(environment, 'FIREBASE_API_KEY'),
    databaseURL: requireEnv(environment, 'FIREBASE_DATABASE_URL'),
  }

  const authDomain = readEnv(environment, 'FIREBASE_AUTH_DOMAIN')
  if (authDomain) config.authDomain = authDomain
  const projectId = readEnv(environment, 'FIREBASE_PROJECT_ID')
  if (projectId) config.projectId = projectId
  const storageBucket = readEnv(environment, 'FIREBASE_STORAGE_BUCKET')
  if (storageBucket) config.storageBucket = storageBucket
  const messagingSenderId = readEnv(environment, 'FIREBASE_MESSAGING_SENDER_ID')
  if (messagingSenderId) config.messagingSenderId = messagingSenderId
  const appId = readEnv(environment, 'FIREBASE_APP_ID')
  if (appId) config.appId = appId
  const measurementId = readEnv(environment, 'FIREBASE_MEASUREMENT_ID')
  if (measurementId) config.measurementId = measurementId

  return config
}
