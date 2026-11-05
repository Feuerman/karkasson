import { describe, expect, it } from 'vitest'
import {
  getClientOrigins,
  getDiagnosticsToken,
  isSocketAdminUIEnabled,
} from '@server/config'

describe('getClientOrigins', () => {
  it('parses a comma-separated allowlist and removes duplicates', () => {
    expect(
      getClientOrigins({
        CLIENT_ORIGIN:
          ' https://example.github.io , https://example.github.io/, https://play.example.com ',
        NODE_ENV: 'production',
      })
    ).toEqual(['https://example.github.io', 'https://play.example.com'])
  })

  it('supports the CLIENT_ORIGINS alias', () => {
    expect(
      getClientOrigins({
        CLIENT_ORIGINS: 'https://client.example',
        NODE_ENV: 'production',
      })
    ).toEqual(['https://client.example'])
  })

  it('uses the public client origin by default in production', () => {
    expect(getClientOrigins({ NODE_ENV: 'production' })).toEqual([
      'https://feuerman.github.io',
    ])
  })

  it('falls back to local development origins outside production', () => {
    expect(getClientOrigins({ NODE_ENV: 'development' })).toContain(
      'http://localhost:5173'
    )
  })

  it('rejects invalid and non-http origins', () => {
    expect(() =>
      getClientOrigins({
        CLIENT_ORIGIN: 'https://example.com, *',
        NODE_ENV: 'production',
      })
    ).toThrow('Invalid origin')

    expect(() =>
      getClientOrigins({
        CLIENT_ORIGIN: 'file:///tmp/client.html',
        NODE_ENV: 'production',
      })
    ).toThrow('Unsupported origin protocol')
  })
})

describe('getDiagnosticsToken', () => {
  it('returns a trimmed token or undefined', () => {
    expect(getDiagnosticsToken({ HEALTH_TOKEN: ' secret ' })).toBe('secret')
    expect(getDiagnosticsToken({ HEALTH_TOKEN: '   ' })).toBeUndefined()
    expect(getDiagnosticsToken({})).toBeUndefined()
  })
})

describe('isSocketAdminUIEnabled', () => {
  it('is enabled in development and disabled in production by default', () => {
    expect(isSocketAdminUIEnabled({ NODE_ENV: 'development' })).toBe(true)
    expect(isSocketAdminUIEnabled({ NODE_ENV: 'production' })).toBe(false)
  })

  it('can be explicitly enabled in production', () => {
    expect(
      isSocketAdminUIEnabled({
        NODE_ENV: 'production',
        SOCKET_ADMIN_UI_ENABLED: 'true',
      })
    ).toBe(true)
  })
})
