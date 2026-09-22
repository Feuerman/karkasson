import { describe, expect, it } from 'vitest'
import { baseGameRules } from '../../src/rules/baseGame'
import { validateExampleGrids } from '../../src/rules/examples'
import type { RulesExample } from '../../src/rules/types'

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
})
