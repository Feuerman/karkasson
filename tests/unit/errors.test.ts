import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CommonErrors,
  GameErrors,
  LobbyErrors,
  SaveErrors,
} from '@server/modules/errors'
import { PLACEMENT_FAILURE_MESSAGE } from '@server/socket/handlers/placementErrors'

const MESSAGES = [
  ...Object.values(CommonErrors),
  ...Object.values(LobbyErrors),
  ...Object.values(GameErrors),
  ...Object.values(SaveErrors),
  PLACEMENT_FAILURE_MESSAGE,
]

const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SOURCE_DIRECTORIES = ['server/src', 'src', 'tests']
const DEFINITION_FILES = [
  resolve(PROJECT_ROOT, 'server/src/modules/errors.ts'),
  resolve(PROJECT_ROOT, 'server/src/socket/handlers/placementErrors.ts'),
]
const ERROR_CATALOGS = [
  { name: 'CommonErrors', values: CommonErrors },
  { name: 'LobbyErrors', values: LobbyErrors },
  { name: 'GameErrors', values: GameErrors },
  { name: 'SaveErrors', values: SaveErrors },
]

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(path)
    return /\.(ts|vue)$/.test(entry.name) ? [path] : []
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

describe('Справочники сообщений об ошибках', () => {
  it('каждое сообщение встречается в справочниках ровно один раз', () => {
    expect(new Set(MESSAGES).size).toBe(MESSAGES.length)
  })

  it('сообщения не продублированы строковыми литералами в исходниках', () => {
    const files = SOURCE_DIRECTORIES.flatMap((directory) =>
      collectSourceFiles(join(PROJECT_ROOT, directory))
    )
    const duplicates = files.flatMap((file) => {
      if (DEFINITION_FILES.includes(resolve(file))) return []
      const content = readFileSync(file, 'utf8')
      return MESSAGES.filter((message) =>
        new RegExp(`['"\`]${escapeRegExp(message)}['"\`]`).test(content)
      ).map((message) => `${file}: ${message}`)
    })

    expect(duplicates).toEqual([])
  })

  it('каждая строковая ошибка сервера объявлена в каталоге', () => {
    const files = collectSourceFiles(join(PROJECT_ROOT, 'server/src/socket'))
    const undocumented: string[] = []
    const knownMessages = new Set(MESSAGES)
    const errorLiteral =
      /(?:throw\s+new\s+Error\s*\(|\berror\s*:|\.emit\(\s*SocketEvents\.Error\s*,)\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g

    for (const file of files) {
      if (resolve(file) === DEFINITION_FILES[1]) continue
      const lines = readFileSync(file, 'utf8').split(/\r?\n/)
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? ''
        errorLiteral.lastIndex = 0
        for (const match of line.matchAll(errorLiteral)) {
          const message = match[2]
          if (message && !knownMessages.has(message)) {
            undocumented.push(`${file}:${index + 1}: ${message}`)
          }
        }
      }
    }

    expect(undocumented).toEqual([])
  })

  it('каталог содержит только сообщения, используемые сервером', () => {
    const files = collectSourceFiles(join(PROJECT_ROOT, 'server/src')).filter(
      (file) => resolve(file) !== DEFINITION_FILES[0]
    )
    const source = files.map((file) => readFileSync(file, 'utf8')).join('\n')
    const unused = ERROR_CATALOGS.flatMap(({ name, values }) =>
      Object.keys(values)
        .filter((key) => !source.includes(`${name}.${key}`))
        .map((key) => `${name}.${key}`)
    )
    const placementReferences = source.match(/PLACEMENT_FAILURE_MESSAGE/g)

    expect(unused).toEqual([])
    expect(placementReferences?.length ?? 0).toBeGreaterThan(1)
  })
})
