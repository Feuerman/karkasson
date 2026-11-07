export interface MetricLabels {
  [key: string]: string
}

/** Экранирует значение метки для формата Prometheus. */
function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

/** Сериализует метки в строку вида {a="1",b="2"} (ключи по алфавиту). */
function serializeLabels(labels?: MetricLabels): string {
  if (!labels || Object.keys(labels).length === 0) return ''
  const pairs = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}="${escapeLabelValue(value)}"`)
  return `{${pairs.join(',')}}`
}

/** Счётчик: значения только растут. */
export class Counter {
  private values = new Map<string, number>()

  inc(value = 1, labels?: MetricLabels): void {
    if (!Number.isFinite(value) || value < 0) return
    const key = serializeLabels(labels)
    this.values.set(key, (this.values.get(key) ?? 0) + value)
  }

  get(labels?: MetricLabels): number {
    return this.values.get(serializeLabels(labels)) ?? 0
  }

  toPrometheus(name: string, help: string): string {
    let lines = `# HELP ${name} ${help}\n# TYPE ${name} counter\n`
    for (const [labels, value] of this.values) {
      lines += `${name}${labels} ${value}\n`
    }
    return lines
  }
}

/** Гистограмма: распределение наблюдений с ведрами (Prometheus-формат). */
export class Histogram {
  private buckets: number[]
  private counts = new Map<string, number>()
  private sums = new Map<string, number>()
  private countsTotal = new Map<string, number>()

  constructor(
    buckets: number[] = [
      0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
    ]
  ) {
    this.buckets = [...buckets].sort((a, b) => a - b)
  }

  observe(value: number, labels?: MetricLabels): void {
    if (!Number.isFinite(value)) return
    const labelsKey = serializeLabels(labels)
    let le = '+Inf'
    for (const bucket of this.buckets) {
      if (value <= bucket) {
        le = String(bucket)
        break
      }
    }
    const bucketKey = `${labelsKey}|${le}`
    this.counts.set(bucketKey, (this.counts.get(bucketKey) ?? 0) + 1)
    this.sums.set(labelsKey, (this.sums.get(labelsKey) ?? 0) + value)
    this.countsTotal.set(labelsKey, (this.countsTotal.get(labelsKey) ?? 0) + 1)
  }

  toPrometheus(name: string, help: string): string {
    let lines = `# HELP ${name} ${help}\n# TYPE ${name} histogram\n`
    const labelSets = new Set<string>()
    for (const key of this.counts.keys()) {
      labelSets.add(key.split('|')[0])
    }
    const cumulative = new Map<string, number>()
    for (const labels of labelSets) {
      let running = 0
      for (const bucket of this.buckets) {
        running += this.counts.get(`${labels}|${String(bucket)}`) ?? 0
        cumulative.set(`${labels}|${String(bucket)}`, running)
      }
      running += this.counts.get(`${labels}|+Inf`) ?? 0
      cumulative.set(`${labels}|+Inf`, running)
    }
    for (const [labels, value] of cumulative) {
      const [labelPart, le] = labels.split('|') as [string, string]
      lines += `${name}_bucket{${labelPart}le="${le}"} ${value}\n`
    }
    for (const labels of labelSets) {
      lines += `${name}_sum${labels} ${this.sums.get(labels) ?? 0}\n`
      lines += `${name}_count${labels} ${this.countsTotal.get(labels) ?? 0}\n`
    }
    return lines
  }
}

/** Гейдж: значение можно устанавливать, увеличивать и уменьшать. */
export class Gauge {
  private values = new Map<string, number>()

  set(value: number, labels?: MetricLabels): void {
    if (!Number.isFinite(value)) return
    this.values.set(serializeLabels(labels), value)
  }

  inc(value = 1, labels?: MetricLabels): void {
    const key = serializeLabels(labels)
    this.values.set(key, (this.values.get(key) ?? 0) + value)
  }

  dec(value = 1, labels?: MetricLabels): void {
    const key = serializeLabels(labels)
    this.values.set(key, (this.values.get(key) ?? 0) - value)
  }

  get(labels?: MetricLabels): number {
    return this.values.get(serializeLabels(labels)) ?? 0
  }

  toPrometheus(name: string, help: string): string {
    let lines = `# HELP ${name} ${help}\n# TYPE ${name} gauge\n`
    for (const [labels, value] of this.values) {
      lines += `${name}${labels} ${value}\n`
    }
    return lines
  }
}

/** Реестр всех метрик сервера. Единственный источник для /metrics. */
export class Registry {
  private entries = new Map<
    string,
    {
      name: string
      help: string
      toPrometheus: (name: string, help: string) => string
    }
  >()

  register(
    name: string,
    help: string,
    metric: { toPrometheus: (name: string, help: string) => string }
  ): void {
    this.entries.set(name, {
      name,
      help,
      toPrometheus: metric.toPrometheus.bind(metric),
    })
  }

  counter(name: string, help: string): Counter {
    const metric = new Counter()
    this.register(name, help, metric)
    return metric
  }

  gauge(name: string, help: string): Gauge {
    const metric = new Gauge()
    this.register(name, help, metric)
    return metric
  }

  histogram(name: string, help: string): Histogram {
    const metric = new Histogram()
    this.register(name, help, metric)
    return metric
  }

  metrics(): string {
    let out = ''
    for (const { name, help, toPrometheus } of this.entries.values()) {
      out += toPrometheus(name, help) + '\n'
    }
    return out
  }
}

export const metrics = new Registry()
