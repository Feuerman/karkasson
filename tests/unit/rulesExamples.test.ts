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
  it('делит правила на базовую игру и отдельный раздел дополнения', () => {
    expect(baseGameRules.sections.map(({ title }) => title)).toEqual([
      'Базовая игра',
      'Таверны и соборы',
      'Принцесса и дракон',
      'Река',
    ])

    const expansionSection = baseGameRules.sections[1]
    expect(
      expansionSection?.blocks.some((block) => block.type === 'example')
    ).toBe(true)

    const princessAndDragonSection = baseGameRules.sections[2]
    const dragonRules = princessAndDragonSection?.blocks.find(
      (block) => block.type === 'list'
    )
    expect(dragonRules?.type).toBe('list')
    if (dragonRules?.type === 'list') {
      expect(dragonRules.items).toHaveLength(7)
      expect(dragonRules.items).toEqual(
        expect.arrayContaining([
          expect.stringContaining('случайное место колоды'),
          expect.stringContaining('до 6 раз'),
          expect.stringContaining('нельзя повторно посещать тайл'),
          expect.stringContaining('Телепортация не снимает подданных'),
        ])
      )
    }
    const dragonTilesRow = princessAndDragonSection?.blocks.find(
      (block) => block.type === 'tiles-row'
    )
    expect(
      dragonTilesRow?.type === 'tiles-row' ? dragonTilesRow.tiles : []
    ).toHaveLength(5)

    const riverSection = baseGameRules.sections[3]
    const riverTilesRow = riverSection?.blocks.find(
      (block) => block.type === 'tiles-row'
    )
    expect(
      riverTilesRow?.type === 'tiles-row' ? riverTilesRow.tiles : []
    ).toHaveLength(11)
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

  it('объясняет базовую игру и отличия от настольной версии', () => {
    const baseSection = baseGameRules.sections[0]
    const exampleIds = collectExamples([baseGameRules])
      .map(({ id }) => id)
      .filter((id) =>
        [
          'shared-road',
          'shared-city-majority',
          'final-scoring',
          'completed-road-ring',
          'completed-city-ring',
          'completed-monastery',
        ].includes(id)
      )
    expect(exampleIds).toEqual([
      'completed-road-ring',
      'completed-city-ring',
      'completed-monastery',
      'shared-road',
      'shared-city-majority',
      'final-scoring',
    ])

    const texts = (baseSection?.blocks ?? [])
      .map((block) =>
        block.type === 'paragraph' || block.type === 'callout'
          ? `${block.title ?? ''} ${block.text}`
          : block.type === 'list'
            ? `${block.title ?? ''} ${block.items.join(' ')}`
            : ''
      )
      .join(' ')

    expect(texts).toContain('в онлайн-версии дорожки нет')
    expect(texts).toContain('поля и крестьяне не реализованы')
    expect(texts).toContain('до размещения подданного')
    expect(texts).toContain(
      'При равенстве каждый лидер получает полную награду'
    )
    expect(texts).toContain('домашние правила')
  })

  it('показывает прямой, поворотный и досрочно завершённый маршрут дракона', () => {
    const examples = collectExamples([baseGameRules])
    const dragonExamples = examples.filter(({ id }) =>
      id.startsWith('dragon-move-')
    )

    expect(dragonExamples.map(({ id }) => id)).toEqual([
      'dragon-move-straight',
      'dragon-move-turns',
      'dragon-move-dead-end',
    ])
    expect(
      dragonExamples.map((example) =>
        example.grid
          .flatMap((row) => row)
          .reduce(
            (count, cellEntry) =>
              count +
              (cellEntry.tile?.markers?.filter(
                (marker) => marker.kind === 'dragon'
              ).length ?? 0),
            0
          )
      )
    ).toEqual([7, 7, 4])

    const dragonSteps = dragonExamples.map((example) =>
      example.grid
        .flatMap((row) => row)
        .flatMap((cellEntry) => cellEntry.tile?.markers ?? [])
        .filter((marker) => marker.kind === 'dragon')
        .map((marker) => marker.step)
        .sort((left, right) => left - right)
    )
    expect(dragonSteps).toEqual([
      [0, 1, 2, 3, 4, 5, 6],
      [0, 1, 2, 3, 4, 5, 6],
      [0, 1, 2, 3],
    ])

    const routeWithFollower = dragonExamples.find(
      ({ id }) => id === 'dragon-move-straight'
    )
    expect(routeWithFollower?.returnedFollowers).toEqual(['coral'])
    expect(
      routeWithFollower?.grid
        .flatMap((row) => row)
        .flatMap((cellEntry) => cellEntry.tile?.markers ?? [])
        .some(
          (marker) => marker.kind === 'follower' && marker.color === 'coral'
        )
    ).toBe(true)
  })
})
