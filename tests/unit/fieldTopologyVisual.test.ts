import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { describe, expect, it } from 'vitest'
import { tiles as baseTiles } from '@server/data/tiles'
import { innsAndCathedralsTiles } from '@server/data/innsAndCathedralsTiles'
import { riverTiles } from '@server/data/riverTiles'
import { princessAndDragonTiles } from '@server/data/princessAndDragonTiles'
import type { FieldBoundaryPort } from '@server/data/fieldTopology'

const SEG_FILE = process.env.SEG_OUT

interface SegEntry {
  ports: Partial<Record<FieldBoundaryPort, number | '?'>>
}

function parseSeg(text: string): Map<string, SegEntry> {
  const result = new Map<string, SegEntry>()
  for (const line of text.split(/\r?\n/)) {
    const match = /^(.+?) components=\d+ (.*)$/.exec(line.trim())
    if (!match) continue
    const ports: SegEntry['ports'] = {}
    for (const pair of match[2].split(/\s+/)) {
      const [name, value] = pair.split('=')
      ports[name as FieldBoundaryPort] =
        value === '?' ? '?' : Number.parseInt(value, 10)
    }
    result.set(match[1], { ports })
  }
  return result
}

function groupsOf(
  ports: Partial<Record<FieldBoundaryPort, number | '?'>>
): string[][] {
  const byId = new Map<number, FieldBoundaryPort[]>()
  for (const [name, value] of Object.entries(ports)) {
    if (value === '?' || value === undefined) continue
    const list = byId.get(value) ?? []
    list.push(name as FieldBoundaryPort)
    byId.set(value, list)
  }
  return [...byId.values()].map((list) => list.sort())
}

function samePartition(a: string[][], b: string[][]): boolean {
  const key = (groups: string[][]) =>
    groups
      .map((group) => group.join(','))
      .sort()
      .join('|')
  return key(a) === key(b)
}

const definitions = [
  ...baseTiles,
  ...innsAndCathedralsTiles,
  ...riverTiles,
  ...princessAndDragonTiles,
]

const maybeDescribe = SEG_FILE ? describe : describe.skip
const seg = SEG_FILE
  ? parseSeg(readFileSync(SEG_FILE, 'utf8'))
  : new Map<string, SegEntry>()

maybeDescribe('сегментация изображений совпадает с каталогом полей', () => {
  it('находит все записи каталога в выводе сегментации', () => {
    const missing = definitions.filter((definition) => {
      const file = basename(definition.imgUrl)
      return !seg.has(file)
    })
    expect(missing.map(({ id }) => id)).toEqual([])
  })

  it('каталог совпадает с компонентами зелёной маски', () => {
    const problems: string[] = []
    for (const definition of definitions) {
      const entry = seg.get(basename(definition.imgUrl))
      if (!entry) continue
      const segGroups = groupsOf(entry.ports)
      const catalogGroups = definition.fieldTopology.map(({ boundaryPorts }) =>
        [...boundaryPorts].sort()
      )
      const segPorts = segGroups.flat().sort()
      const catalogPorts = catalogGroups.flat().sort()
      if (segPorts.join() !== catalogPorts.join()) {
        problems.push(
          `${definition.id}: ports seg=[${segPorts.join(',')}] ` +
            `catalog=[${catalogPorts.join(',')}]`
        )
        continue
      }
      if (!samePartition(segGroups, catalogGroups)) {
        problems.push(
          `${definition.id}: groups seg=${JSON.stringify(segGroups)} ` +
            `catalog=${JSON.stringify(catalogGroups)}`
        )
      }
    }
    expect(problems).toEqual([])
  })
})
