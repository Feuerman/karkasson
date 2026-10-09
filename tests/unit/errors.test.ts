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
import { PLACEMENT_FAILURE_MESSAGE } from '@server/modules/gameGeometry'

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
  resolve(PROJECT_ROOT, 'server/src/modules/gameGeometry.ts'),
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
})
