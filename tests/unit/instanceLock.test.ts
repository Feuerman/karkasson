import { describe, expect, it } from 'vitest'
import { InMemoryGameDatabase } from '@server/modules/Database'
import { InstanceLock } from '@server/modules/instanceLock'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('Блокировка инстанса сервера (single-instance)', () => {
  it('первый инстанс забирает блокировку, второй отказывается, после освобождения — второй забирает', async () => {
    const db = new InMemoryGameDatabase()
    const first = new InstanceLock({ db, instanceId: 'instance-a' })
    const second = new InstanceLock({ db, instanceId: 'instance-b' })

    expect(await first.acquire()).toBe(true)
    expect(first.isHeld()).toBe(true)

    // Другой инстанс на той же базе не может стартовать, пока блокировка актуальна.
    expect(await second.acquire()).toBe(false)
    expect(second.isHeld()).toBe(false)

    await first.release()
    expect(await second.acquire()).toBe(true)
    expect(second.isHeld()).toBe(true)

    await second.release()
  })

  it('освобождение чужой блокировки игнорируется', async () => {
    const db = new InMemoryGameDatabase()
    const first = new InstanceLock({ db, instanceId: 'instance-a' })
    const second = new InstanceLock({ db, instanceId: 'instance-b' })

    expect(await first.acquire()).toBe(true)

    await second.release()

    // first всё ещё hält блокировку: второй по-прежнему не может acquired.
    expect(await second.acquire()).toBe(false)

    await first.release()
  })

  it('устаревшая блокировка забирается другим инстансом после аварии владельца', async () => {
    const db = new InMemoryGameDatabase()
    // Малый порог устаревания и редкий heartbeat: блокировка быстро становится старой.
    const first = new InstanceLock({
      db,
      instanceId: 'instance-a',
      heartbeatMs: 10_000,
      staleMs: 50,
    })
    const second = new InstanceLock({
      db,
      instanceId: 'instance-b',
      heartbeatMs: 10_000,
      staleMs: 50,
    })

    expect(await first.acquire()).toBe(true)

    // first не обновляет heartbeat (интервал 10 с): ждём истечения порога.
    await sleep(70)

    expect(await second.acquire()).toBe(true)
    expect(second.isHeld()).toBe(true)

    await second.release()
  })
})
