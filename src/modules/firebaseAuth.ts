/**
 * Клиентская аутентификация через Firebase Auth.
 *
 * Инициализирует Firebase App и Auth, предоставляет вход через Google OAuth.
 * Конфигурация берётся из VITE_FIREBASE_* переменных окружения; если они не
 * заданы, модуль всё ещё импортируется, но функции входа возвращают понятную
 * ошибку.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  type User,
  type Auth,
} from 'firebase/auth'

const requiredEnv = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
]

let app: FirebaseApp | null = null
let auth: Auth | null = null

function isConfigured(): boolean {
  return requiredEnv.every(
    (key) =>
      typeof import.meta.env[key] === 'string' &&
      import.meta.env[key].length > 0
  )
}

export function initFirebaseAuth(): { app: FirebaseApp; auth: Auth } | null {
  if (!isConfigured()) return null
  if (getApps().length > 0) {
    app = getApps()[0]
  } else {
    app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    })
  }
  auth = getAuth(app)
  return { app, auth }
}

export function getFirebaseAuth(): Auth | null {
  return auth
}

/** Вход через Google OAuth (popup). Возвращает пользователя и ID token. */
export async function signInWithGoogle(): Promise<{
  user: User
  idToken: string
}> {
  const authInstance = getFirebaseAuth() ?? initFirebaseAuth()?.auth
  if (!authInstance) {
    throw new Error(
      'Firebase Auth не сконфигурирован: задайте VITE_FIREBASE_* переменные'
    )
  }

  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(authInstance, provider)
  const user = result.user
  const idToken = await user.getIdToken()
  return { user, idToken }
}
