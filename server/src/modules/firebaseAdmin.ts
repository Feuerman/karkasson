import { getFirebaseConfig } from '../config'
import { createLogger } from '../utils/logger'
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getAuth as getAdminAuth, type Auth } from 'firebase-admin/auth'

const logger = createLogger('firebaseAdmin')

let adminApp: App | null = null
let adminAuth: Auth | null = null

function initialize(): void {
  if (getApps().length > 0) {
    adminApp = getApps()[0]
  } else {
    try {
      const config = getFirebaseConfig()
      adminApp = initializeApp({
        credential: cert(config.serviceAccount),
        databaseURL: config.databaseURL,
        projectId: config.serviceAccount.projectId,
      })
    } catch (error: unknown) {
      logger.debug(
        'Firebase Admin SDK не сконфигурирован: ID token не будут верифицироваться',
        error
      )
      return
    }
  }
  if (adminApp) {
    adminAuth = getAdminAuth(adminApp)
  }
}

function ensureInitialized(): Auth | null {
  if (!adminAuth) initialize()
  return adminAuth
}

/**
 * Верифицирует Firebase ID token и возвращает данные пользователя.
 * Возвращает null, если Admin SDK не сконфигурирован (разработка/тесты)
 * или токен недействителен.
 */
export async function verifyIdToken(idToken: string): Promise<{
  uid: string
  email?: string | null
  name?: string | null
  picture?: string | null
} | null> {
  const auth = ensureInitialized()
  if (!auth) return null

  try {
    const decoded = (await auth.verifyIdToken(idToken)) as {
      uid: string
      email?: string | null
      name?: string | null
      picture?: string | null
    }
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: decoded.name ?? null,
      picture: decoded.picture ?? null,
    }
  } catch (error: unknown) {
    logger.debug('Не удалось верифицировать ID token', error)
    return null
  }
}

export function isFirebaseAdminConfigured(): boolean {
  return adminAuth !== null || getApps().length > 0
}
