import { describe, expect, it, vi, afterEach } from 'vitest'
import { metrics } from '@server/metrics/registry'

describe('metrics registry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('counter суммирует значения по одинаковым метрикам', () => {
    const c = metrics.counter('uniq_counter_total', 'help counter')
    c.inc(5, { a: '1' })
    c.inc(3, { a: '1' })
    c.inc(2, { a: '2' })
    expect(c.get({ a: '1' })).toBe(8)
    expect(c.get({ a: '2' })).toBe(2)
    expect(c.get({ a: '3' })).toBe(0)

    const text = c.toPrometheus('uniq_counter_total', 'help counter')
    expect(text).toContain('# TYPE uniq_counter_total counter')
    expect(text).toContain('uniq_counter_total{a="1"} 8')
    expect(text).toContain('uniq_counter_total{a="2"} 2')
  })

  it('counter игнорирует отрицательные и нечисловые значения', () => {
    const c = metrics.counter('uniq_counter2_total', 'help')
    c.inc(-1)
    c.inc(NaN as unknown as number)
    c.inc(Infinity as unknown as number)
    expect(c.get()).toBe(0)
  })

  it('gauge поддерживает set/inc/dec', () => {
    const g = metrics.gauge('uniq_gauge', 'help gauge')
    g.set(10, { b: 'x' })
    g.inc(5, { b: 'x' })
    g.dec(3, { b: 'x' })
    expect(g.get({ b: 'x' })).toBe(12)
    const text = g.toPrometheus('uniq_gauge', 'help gauge')
    expect(text).toContain('# TYPE uniq_gauge gauge')
    expect(text).toContain('uniq_gauge{b="x"} 12')
  })

  it('histogram учитывает ведра, сумму и количество', () => {
    const h = metrics.histogram('uniq_histogram_seconds', 'help histogram')
    h.observe(0.003)
    h.observe(0.008)
    h.observe(0.03)
    h.observe(0.03)
    const text = h.toPrometheus('uniq_histogram_seconds', 'help histogram')
    expect(text).toContain('# TYPE uniq_histogram_seconds histogram')
    // 0.003 <= 0.005, 0.008 <= 0.01, 0.03 <= 0.05 (дважды)
    expect(text).toContain('uniq_histogram_seconds_bucket{le="0.005"} 1')
    expect(text).toContain('uniq_histogram_seconds_bucket{le="0.01"} 2')
    expect(text).toContain('uniq_histogram_seconds_bucket{le="0.05"} 4')
    expect(text).toContain('uniq_histogram_seconds_bucket{le="+Inf"} 4')
    expect(text).toContain('uniq_histogram_seconds_sum 0.071')
    expect(text).toContain('uniq_histogram_seconds_count 4')
  })

  it('histogram игнорирует нечисловые значения', () => {
    const h = metrics.histogram('uniq_histogram2_seconds', 'help')
    h.observe(NaN as unknown as number)
    h.observe(0.5)
    const text = h.toPrometheus('uniq_histogram2_seconds', 'help')
    expect(text).toContain('uniq_histogram2_seconds_count 1')
  })

  it('Реестр объединяет все метрики в одном выводе', () => {
    metrics.counter('registry_counter_total', 'help')
    metrics.gauge('registry_gauge', 'help')
    metrics.histogram('registry_histogram_seconds', 'help')
    const text = metrics.metrics()
    expect(text).toContain('# HELP registry_counter_total help')
    expect(text).toContain('# HELP registry_gauge help')
    expect(text).toContain('# HELP registry_histogram_seconds help')
    expect(text).toContain('# TYPE registry_counter_total counter')
    expect(text).toContain('# TYPE registry_gauge gauge')
    expect(text).toContain('# TYPE registry_histogram_seconds histogram')
  })
})
