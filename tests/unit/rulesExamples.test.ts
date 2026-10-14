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

  it('для каждого ключевого правила есть наглядный пример', () => {
    const ids = collectExamples([baseGameRules]).map(({ id }) => id)

    expect(ids).toEqual(
      expect.arrayContaining([
        // Размещение тайла и соединение объектов.
        'road-connection',
        'wrong-placement',
        'city-corners',
        // Когда объект считается завершённым.
        'road-crossroads',
        'road-loop',
        'completed-road-ring',
        'completed-city-ring',
        'completed-monastery',
        // Аббат, сады и отзыв.
        'partial-garden',
        'abbot-recall',
        'completed-garden',
        // Борьба за большинство.
        'shared-road',
        'shared-city-majority',
        'big-follower-majority',
        // Финальный подсчёт.
        'final-scoring',
        // Дополнения.
        'inn-road',
        'inn-twice',
        'cathedral-city',
      ])
    )
  })

  it('примеры поясняют подсчёт очков в подписи', () => {
    for (const example of collectExamples([baseGameRules])) {
      expect(example.caption?.trim(), example.id).toBeTruthy()
    }
  })

  it('правила собора описывают ставку, совпадающую с подсчётом очков', () => {
    const expansion = baseGameRules.sections.find(
      ({ id }) => id === 'inns-and-cathedrals'
    )
    const cathedralRules = expansion?.blocks.find(
      (block) => block.type === 'paragraph' && block.title === 'Соборы'
    )
    const cathedralExample = collectExamples([baseGameRules]).find(
      ({ id }) => id === 'cathedral-city'
    )
    const scoringTable = expansion?.blocks.find(
      (block) => block.type === 'table' && block.title === 'Очки с дополнением'
    )

    expect(cathedralRules?.type).toBe('paragraph')
    if (cathedralRules?.type !== 'paragraph') return
    expect(cathedralRules.text).toContain(
      'каждый тайл города и каждый герб приносят по 3 очка'
    )
    expect(cathedralRules.text).toContain('(2 + 1) × 3 = 9 очков')
    expect(cathedralExample?.caption).toContain('5 × 3 = 15')
    expect(scoringTable?.type).toBe('table')
    if (scoringTable?.type !== 'table') return
    expect(scoringTable.rows).toContainEqual([
      'Город с собором',
      '3 очка за каждый тайл и герб',
      '0 очков',
    ])
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
