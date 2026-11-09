import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@server/modules/password'

describe('Хеширование пароля лобби', () => {
  it('проверяет верный пароль', () => {
    const hash = hashPassword('секретный-пароль')
    expect(verifyPassword('секретный-пароль', hash)).toBe(true)
  })

  it('отвергает неверный пароль', () => {
    const hash = hashPassword('пароль')
    expect(verifyPassword('непароль', hash)).toBe(false)
  })

  it('не хранит пароль открытым текстом', () => {
    const hash = hashPassword('sekret')
    expect(hash).not.toBe('sekret')
    expect(hash).toMatch(/^scrypt\$salt=[0-9a-f]+\$hash=[0-9a-f]+$/)
  })

  it('при каждом вызове даёт разный хеш для одного пароля', () => {
    const hash1 = hashPassword('sekret')
    const hash2 = hashPassword('sekret')
    expect(hash1).not.toBe(hash2)
    expect(verifyPassword('sekret', hash1)).toBe(true)
    expect(verifyPassword('sekret', hash2)).toBe(true)
  })

  it('отвергает подделку хеша', () => {
    const hash = hashPassword('sekret')
    const tampered = hash.replace(/hash=/, 'hash=00')
    expect(verifyPassword('sekret', tampered)).toBe(false)
  })

  it.each([
    '',
    'not-a-hash',
    'scrypt$salt=deadbeef',
    'sha256$sekret',
    'scrypt$salt=zz$hash=zz',
  ])('отвергает неверный формат %s', (expected) => {
    expect(verifyPassword('sekret', expected)).toBe(false)
  })
})
