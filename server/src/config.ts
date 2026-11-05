import { createPrivateKey } from 'node:crypto'
import { createLogger } from './utils/logger'

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

const logger = createLogger('config')

// Публичный web-конфиг проекта. Это не секрет; значения можно переопределить
// переменными окружения, но для запуска на хостинге они больше не обязательны.
const DEFAULT_FIREBASE_API_KEY = 'AIzaSyDyRbOXPz22xQVZndSmwwXWwfBXXQw-adw'
const DEFAULT_FIREBASE_DATABASE_URL =
  'https://karkassone-a5080-default-rtdb.firebaseio.com/'

/** Канонический Origin или `null`, если значение не является http(s)-Origin. */
function normalizeOrigin(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return url.origin
}

/**
 * Разрешённые Origin клиента. Значение задаётся списком через запятую в
 * `CLIENT_ORIGIN` (предпочтительно) или `CLIENT_ORIGINS`.
 *
 * Ошибочное значение не должно ронять сервер: например, `*` или Origin без
 * схемы нельзя использовать как allowlist, но из-за опечатки в окружении
 * всё приложение не должно превращаться в 503. Такие значения игнорируются с
 * предупреждением, а если валидных не осталось — берётся значение по
 * умолчанию. Произвольный Origin при этом не разрешается никогда.
 */
export function getClientOrigins(
  environment: NodeJS.ProcessEnv = process.env
): string[] {
  const raw =
    readEnv(environment, 'CLIENT_ORIGIN') ??
    readEnv(environment, 'CLIENT_ORIGINS')
  const values = (raw ?? '').split(',').map((value) => value.trim())
  const configured = values.filter(Boolean)

  if (configured.length > 0) {
    const origins: string[] = []
    const invalid: string[] = []

    for (const value of configured) {
      const origin = normalizeOrigin(value)
      if (origin) origins.push(origin)
      else invalid.push(value)
    }

    if (invalid.length > 0) {
      logger.warn(
        `Ignoring invalid client origin value(s): ${invalid.join(', ')}`
      )
    }

    const uniqueOrigins = [...new Set(origins)]
    if (uniqueOrigins.length > 0) return uniqueOrigins

    logger.warn('No valid client origins configured; using defaults')
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

/**
 * Сервисный аккаунт Firebase. Ключ подписи используется только на сервере и
 * никогда не попадает в клиентскую сборку.
 */
export interface FirebaseServiceAccount {
  projectId: string
  clientEmail: string
  privateKey: string
}

export interface FirebaseConfig {
  apiKey: string
  databaseURL: string
  serviceAccount: FirebaseServiceAccount | null
}

function readEnv(
  environment: NodeJS.ProcessEnv,
  name: string
): string | undefined {
  const value = environment[name]?.trim()
  return value ? value : undefined
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
 * Разбирает JSON сервисного аккаунта. В окружении ключ обычно задан одной
 * строкой, поэтому переносы `private_key` могут быть экранированы как `\n`.
 */
function parseServiceAccount(raw: string): FirebaseServiceAccount {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT must contain valid JSON')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('FIREBASE_SERVICE_ACCOUNT must contain a JSON object')
  }

  const record = parsed as Record<string, unknown>
  const projectId = readStringValue(record.project_id)
  const clientEmail = readStringValue(record.client_email)
  const privateKey = readStringValue(record.private_key)

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT must include project_id, client_email and private_key'
    )
  }

  const normalizedPrivateKey = privateKey.replace(/\\n/g, '\n').trim()
  try {
    createPrivateKey(normalizedPrivateKey)
  } catch {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT private_key is not a valid PEM key'
    )
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizedPrivateKey,
  }
}

function readStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/**
 * Конфигурация Firebase Realtime Database. FIREBASE_API_KEY и
 * FIREBASE_DATABASE_URL можно переопределить, иначе берутся публичные значения
 * проекта. FIREBASE_SERVICE_ACCOUNT необязателен: с ним сервер входит в Firebase
 * и работает по закрытым правилам, без него используется прежний доступ.
 *
 * Нужен только production-серверу, в разработке и тестах работает in-memory
 * хранилище.
 */
export function getFirebaseConfig(
  environment: NodeJS.ProcessEnv = process.env
): FirebaseConfig {
  const rawServiceAccount = readEnv(environment, 'FIREBASE_SERVICE_ACCOUNT')
  if (!rawServiceAccount) {
    logger.warn(
      'FIREBASE_SERVICE_ACCOUNT is not set: Firebase access is unauthenticated and requires permissive database rules'
    )
  }
  return {
    apiKey:
      readEnv(environment, 'FIREBASE_API_KEY') ?? DEFAULT_FIREBASE_API_KEY,
    databaseURL:
      readEnv(environment, 'FIREBASE_DATABASE_URL') ??
      DEFAULT_FIREBASE_DATABASE_URL,
    serviceAccount: rawServiceAccount
      ? parseServiceAccount(rawServiceAccount)
      : null,
  }
}
