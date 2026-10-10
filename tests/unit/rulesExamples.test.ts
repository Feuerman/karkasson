import { describe, expect, it } from 'vitest'
import { baseGameRules } from '@/rules/baseGame'
import { validateExampleGrids } from '@/rules/examples'
import type { RulesExample } from '@/rules/types'

/**
 * Гарантирует, что все наглядные примеры в правилах корректны:
 * прилегающие грани тайлов совпадают по типу, а маркеры подданных
 * стоят на реальных объектах (дорога/город/монастырь).
 */

function collectExamples(docs: { sections: { blocks: unknown[] }[] }[]) {
  return docs
    .flatMap((doc) => doc.sections)
    .flatMap((section) => section.blocks)
    .filter(
      (block): block is RulesExample & { type: 'example' } =>
        block !== null &&
        typeof block === 'object' &&
        'type' in block &&
        (block as { type: string }).type === 'example'
    )
}

describe('примеры правил', () => {
  it('раздел дополнения содержит примеры, а каталоги тайлов подключены', () => {
    expect(baseGameRules.sections.map(({ title }) => title)).toEqual([
      'Базовая игра',
      'Таверны и соборы',
      'Принцесса и дракон',
      'Река',
    ])

    const [, expansionSection] = baseGameRules.sections
    expect(
      expansionSection?.blocks.some((block) => block.type === 'example')
    ).toBe(true)

    for (const section of baseGameRules.sections.slice(2)) {
      expect(
        section.blocks.some((block) => block.type === 'tiles-row'),
        section.title
      ).toBe(true)
    }
  })

  it('все сетки примеров корректны (грани совпадают, маркеры осмысленны)', () => {
    const examples = collectExamples([baseGameRules])
    expect(examples.length).toBeGreaterThan(0)

    const errors = validateExampleGrids(examples)
    expect(errors, `Ошибки в примерах:\n${errors.join('\n')}`).toEqual([])
  })

  it('у каждого примера уникальный id и заполненная сетка', () => {
    const examples = collectExamples([baseGameRules])
    const ids = examples.map((example) => example.id)
    expect(new Set(ids).size).toBe(ids.length)

    examples.forEach((example) => {
      expect(example.grid.length, example.id).toBeGreaterThan(0)
      example.grid.forEach((row) => {
        expect(row.length, example.id).toBeGreaterThan(0)
      })
    })
  })

  it('маршрут дракона в примерах пронумерован подряд и без повторов', () => {
    const dragonExamples = collectExamples([baseGameRules]).filter(({ id }) =>
      id.startsWith('dragon-move-')
    )
    expect(dragonExamples.length).toBeGreaterThan(0)

    for (const example of dragonExamples) {
      const steps = example.grid
        .flatMap((row) => row)
        .flatMap((cellEntry) => cellEntry.tile?.markers ?? [])
        .filter((marker) => marker.kind === 'dragon')
        .map((marker) => marker.step)
        .sort((left, right) => left - right)

      // Каждый тайл маршрута посещён один раз, нумерация шагов без пропусков.
      expect(steps, example.id).toEqual(
        Array.from({ length: steps.length }, (_, index) => index)
      )
    }
  })

  it('примеры дракона показывают возврат съеденного подданного', () => {
    const straight = collectExamples([baseGameRules]).find(
      ({ id }) => id === 'dragon-move-straight'
    )

    expect(straight?.returnedFollowers).toEqual(['coral'])
    expect(
      straight?.grid
        .flatMap((row) => row)
        .flatMap((cellEntry) => cellEntry.tile?.markers ?? [])
        .some(
          (marker) => marker.kind === 'follower' && marker.color === 'coral'
        )
    ).toBe(true)
  })
})
