export const PORT = Number(process.env.PORT) || 3001

export const IS_PRODUCTION = process.env.NODE_ENV === 'production'

export const ADMIN_UI_ORIGIN = 'https://admin.socket.io'

// Origin, с которых разрешено подключаться клиенту в разработке и тестах.
const DEFAULT_CLIENT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]

// Публичный адрес клиента проекта. Используется, если production-деплой не
// переопределил Origin через CLIENT_ORIGIN.
const DEFAULT_PRODUCTION_CLIENT_ORIGINS = ['https://feuerman.github.io']

function normalizeOrigin(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Invalid origin "${value}"`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported origin protocol in "${value}"`)
  }
  return url.origin
}

/**
 * Разрешённые Origin клиента. Значение задаётся списком через запятую в
 * `CLIENT_ORIGIN` (предпочтительно) или `CLIENT_ORIGINS`. Без переменной в
 * production используется публичный адрес клиента проекта; произвольный
 * Origin не разрешается никогда.
 */
export function getClientOrigins(
  environment: NodeJS.ProcessEnv = process.env
): string[] {
  const raw =
    readEnv(environment, 'CLIENT_ORIGIN') ??
    readEnv(environment, 'CLIENT_ORIGINS')
  const values = (raw ?? '').split(',').map((value) => value.trim())
  const origins = values.filter(Boolean)

  if (origins.length > 0) {
    return [...new Set(origins.map(normalizeOrigin))]
  }

  if (environment.NODE_ENV === 'production') {
    return [...DEFAULT_PRODUCTION_CLIENT_ORIGINS]
  }
  return [...DEFAULT_CLIENT_ORIGINS]
}

/**
 * Токен защищённого диагностического endpoint. Если не задан, подробная
 * диагностика недоступна: публичный `/health` остаётся минимальным.
 */
export function getDiagnosticsToken(
  environment: NodeJS.ProcessEnv = process.env
): string | undefined {
  return readEnv(environment, 'HEALTH_TOKEN')
}

/**
 * Socket.IO Admin UI полезен для отладки, но в production он не должен быть
 * доступен на публичном сервере без явного решения эксплуатации.
 */
export function isSocketAdminUIEnabled(
  environment: NodeJS.ProcessEnv = process.env
): boolean {
  if (environment.NODE_ENV !== 'production') return true
  return environment.SOCKET_ADMIN_UI_ENABLED === 'true'
}

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

// Верхняя граница размера одного Socket.IO-пакета.
export const MAX_HTTP_BUFFER_SIZE = 64 * 1024

// Таймауты HTTP и Socket.IO: не держим полуоткрытые соединения бесконечно.
export const SOCKET_PING_INTERVAL_MS = 25_000
export const SOCKET_PING_TIMEOUT_MS = 20_000
export const SOCKET_UPGRADE_TIMEOUT_MS = 10_000
export const SOCKET_CONNECT_TIMEOUT_MS = 20_000
export const HTTP_REQUEST_TIMEOUT_MS = 30_000
export const HTTP_HEADERS_TIMEOUT_MS = 15_000

// Сколько сокетов с одного IP может держать сервер одновременно.
export const MAX_SOCKETS_PER_IP = 20

// Общее число партий в памяти и число лобби, созданных одной сессией.
export const MAX_TOTAL_GAMES = 500
export const MAX_OWNED_LOBBIES = 5

// Доверять ли `X-Forwarded-For`. Включать только за доверенным прокси.
export const TRUST_PROXY = process.env.TRUST_PROXY === 'true'

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
 * Секрет подписи токенов сессий.
 *
 * В production обязателен: без него сервер не должен запускаться, иначе
 * токены можно подделать. В разработке и тестах берётся стабильное значение,
 * чтобы перезапуск не обрывал уже выданные сессии.
 */
export function getSessionSecret(
  environment: NodeJS.ProcessEnv = process.env
): string {
  const secret = readEnv(environment, 'SESSION_SECRET')
  if (secret) {
    if (secret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters long')
    }
    return secret
  }
  if (environment.NODE_ENV === 'production') {
    throw new Error('Missing required environment variable SESSION_SECRET')
  }
  return 'karkasson-development-session-secret'
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
