import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SOURCE_ROOT = fileURLToPath(new URL('../../src', import.meta.url))
const SOURCE_EXTENSIONS = new Set(['.js', '.ts', '.vue'])
const DANGEROUS_HTML_SINKS = [
  /v-html/,
  /\.innerHTML\b/,
  /\.outerHTML\b/,
  /insertAdjacentHTML/,
  /document\.write\b/,
]

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : []
  })
}

describe('Безопасность разметки', () => {
  it('не вставляет HTML в обход экранирования Vue', () => {
    const offenders = sourceFiles(SOURCE_ROOT).flatMap((file) => {
      const content = readFileSync(file, 'utf8')
      return DANGEROUS_HTML_SINKS.filter((pattern) =>
        pattern.test(content)
      ).map((pattern) => `${file}: ${pattern}`)
    })

    expect(offenders).toEqual([])
  })

  it('запрещает внешние скрипты политикой CSP', () => {
    const config = readFileSync(
      fileURLToPath(new URL('../../vite.config.js', import.meta.url)),
      'utf8'
    )

    expect(config).toContain("script-src 'self'")
  })
})
