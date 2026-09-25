import { describe, expect, it } from 'vitest'
import { getSocketAdminUIOptions } from '../../server/src/config'

describe('getSocketAdminUIOptions', () => {
  it('disables the Admin UI when credentials are absent', () => {
    expect(getSocketAdminUIOptions({})).toBeNull()
  })

  it('requires username and password hash together', () => {
    expect(() =>
      getSocketAdminUIOptions({ SOCKET_ADMIN_UI_USERNAME: 'operator' })
    ).toThrow('SOCKET_ADMIN_UI_USERNAME and SOCKET_ADMIN_UI_PASSWORD_HASH')
  })

  it('uses bcrypt credentials and read-only mode by default', () => {
    expect(
      getSocketAdminUIOptions({
        SOCKET_ADMIN_UI_USERNAME: 'operator',
        SOCKET_ADMIN_UI_PASSWORD_HASH: '$2b$10$hash',
        NODE_ENV: 'production',
      })
    ).toEqual({
      auth: {
        type: 'basic',
        username: 'operator',
        password: '$2b$10$hash',
      },
      mode: 'production',
      readonly: true,
    })
  })

  it('allows socket administration only when explicitly enabled', () => {
    expect(
      getSocketAdminUIOptions({
        SOCKET_ADMIN_UI_USERNAME: 'operator',
        SOCKET_ADMIN_UI_PASSWORD_HASH: '$2b$10$hash',
        SOCKET_ADMIN_UI_READONLY: 'false',
      })?.readonly
    ).toBe(false)
  })
})
