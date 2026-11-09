import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SCRYPT_KEY_LEN = 64
const SCRYPT_PREFIX = 'scrypt'

/** Хеш пароля в формате `scrypt$salt=<hex>$hash=<hex>`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, SCRYPT_KEY_LEN)
  return `${SCRYPT_PREFIX}$salt=${salt}$hash=${derived.toString('hex')}`
}

/**
 * Сверяет пароль с хранимого хеша за время, не зависящее от содержимого пароля.
 * Неизвестный или неверный формат хеша — неверный пароль.
 */
export function verifyPassword(password: string, expected: string): boolean {
  const match = /^scrypt\$salt=([0-9a-f]+)\$hash=([0-9a-f]+)$/.exec(expected)
  if (!match) return false
  const [, saltHex, hashHex] = match
  let derived: Buffer
  try {
    derived = scryptSync(password, saltHex, SCRYPT_KEY_LEN)
  } catch {
    return false
  }
  const hash = Buffer.from(hashHex, 'hex')
  if (hash.length !== derived.length) return false
  return timingSafeEqual(hash, derived)
}
