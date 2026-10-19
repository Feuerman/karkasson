import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  pendingActionKeys,
  usePendingActions,
} from '@/composables/usePendingActions'

/**
 * Индикатор занятости должен появляться на всё время ожидания ответа сервера,
 * сниматься в том числе при отказе и не пропускать повторную команду, пока
 * предыдущая ещё выполняется.
 */

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('pendingActionKeys', () => {
  it('разделяет ключи разных игр и слотов', () => {
    expect(pendingActionKeys.joinGame('a')).not.toBe(
      pendingActionKeys.joinGame('b')
    )
    expect(pendingActionKeys.slot(0)).not.toBe(pendingActionKeys.slot(1))
    expect(pendingActionKeys.joinGame('a')).not.toBe(
      pendingActionKeys.rejoinGame('a')
    )
    expect(pendingActionKeys.slot(1)).toBe(pendingActionKeys.slot(1))
  })
})

describe('usePendingActions', () => {
  it('не показывает занятость до запуска команды', () => {
    const { isPending, pendingList } = usePendingActions()

    expect(isPending(pendingActionKeys.startGame())).toBe(false)
    expect(pendingList.value).toEqual([])
  })

  it('показывает занятость во время выполнения и снимает после', async () => {
    const { isPending, pendingList, runPending } = usePendingActions()
    const gate = deferred<string>()

    const running = runPending(
      pendingActionKeys.createGame(),
      () => gate.promise
    )

    expect(isPending(pendingActionKeys.createGame())).toBe(true)
    expect(pendingList.value).toEqual([pendingActionKeys.createGame()])

    gate.resolve('готово')
    await expect(running).resolves.toBe('готово')

    expect(isPending(pendingActionKeys.createGame())).toBe(false)
    expect(pendingList.value).toEqual([])
  })

  it('снимает занятость после отказа команды', async () => {
    const { isPending, runPending } = usePendingActions()
    const key = pendingActionKeys.slot(2)

    await expect(
      runPending(key, () => Promise.reject(new Error('отказ сервера')))
    ).rejects.toThrow('отказ сервера')

    expect(isPending(key)).toBe(false)
  })

  it('не запускает команду повторно, пока предыдущая выполняется', async () => {
    const { isPending, runPending } = usePendingActions()
    const key = pendingActionKeys.slot(0)
    const gate = deferred<void>()
    const command = vi.fn(() => gate.promise)

    const first = runPending(key, command)
    const second = await runPending(key, command)

    expect(second).toBeUndefined()
    expect(command).toHaveBeenCalledTimes(1)

    gate.resolve()
    await first
    await nextTick()

    expect(isPending(key)).toBe(false)
  })

  it('ведёт разные команды независимо', async () => {
    const { isPending, pendingList, runPending } = usePendingActions()
    const gate = deferred<void>()

    const running = runPending(
      pendingActionKeys.startGame(),
      () => gate.promise
    )

    expect(isPending(pendingActionKeys.startGame())).toBe(true)
    expect(isPending(pendingActionKeys.leaveGame())).toBe(false)
    expect(pendingList.value).toHaveLength(1)

    gate.resolve()
    await running

    expect(isPending(pendingActionKeys.startGame())).toBe(false)
  })
})
