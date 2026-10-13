import { afterEach, describe, expect, it, vi } from 'vitest'
import { InMemoryGameDatabase } from '@server/modules/Database'
import { GameService } from '@server/services/GameService'

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000
const TWENTY_MINUTES = 20 * 60 * 1000

function startedGame(service: GameService) {
  const game = service.createLobby('socket-1')
  game.gameIsStarted = true
  return game
}

function serviceWithGame() {
  const db = new InMemoryGameDatabase()
  return { db, service: new GameService(db) }
}

describe('Сборка забытых партий', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('обновляет метку активности на живом объекте партии', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const service = new GameService(new InMemoryGameDatabase())
    const game = startedGame(service)
    await service.saveGame(game.id)

    expect(game.lastUpdate).toBe(Date.now())
  })

  it('не удаляет партию, в которой продолжают играть', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const service = new GameService(new InMemoryGameDatabase())
    const game = startedGame(service)
    await service.saveGame(game.id)

    // Сборщик видит свежую партию и оставляет её в покое
    vi.advanceTimersByTime(TWENTY_MINUTES)
    expect(await service.deleteStaleGames(INACTIVITY_TIMEOUT_MS)).toEqual([])

    // Игрок ходит, затем ещё один игровой отрезок без активности
    await service.saveGame(game.id)
    vi.advanceTimersByTime(TWENTY_MINUTES)
    expect(await service.deleteStaleGames(INACTIVITY_TIMEOUT_MS)).toEqual([])

    // С момента последнего хода прошло меньше таймаута, хотя с момента
    // создания партии — больше
    expect(service.getGame(game.id)).toBeDefined()
  })

  it('удаляет партию, в которой давно не играли', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const service = new GameService(new InMemoryGameDatabase())
    const game = startedGame(service)
    await service.saveGame(game.id)

    vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS + 60_000)

    expect(await service.deleteStaleGames(INACTIVITY_TIMEOUT_MS)).toEqual([
      game.id,
    ])
    expect(service.getGame(game.id)).toBeUndefined()
  })

  it('не трогает завершённые и ещё не начатые партии', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const service = new GameService(new InMemoryGameDatabase())
    const notStarted = service.createLobby('socket-1')
    const ended = startedGame(service)
    ended.gameIsEnded = true

    await service.saveGame(notStarted.id)
    await service.saveGame(ended.id)

    vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS * 10)
    expect(await service.deleteStaleGames(INACTIVITY_TIMEOUT_MS)).toEqual([])
    expect(service.getGame(notStarted.id)).toBeDefined()
    expect(service.getGame(ended.id)).toBeDefined()
  })
})

describe('Очередь команд партии', () => {
  it('выполняет команды одной партии строго по порядку', async () => {
    const { service } = serviceWithGame()
    const game = startedGame(service)
    const order: string[] = []

    const first = service.runGameCommand(game.id, async () => {
      order.push('first:start')
      await new Promise((resolve) => setTimeout(resolve, 30))
      order.push('first:end')
      return 1
    })
    const second = service.runGameCommand(game.id, async () => {
      order.push('second:start')
      return 2
    })

    expect(await first).toBe(1)
    expect(await second).toBe(2)
    expect(order).toEqual(['first:start', 'first:end', 'second:start'])
  })

  it('не ждёт команды другой партии', async () => {
    const { service } = serviceWithGame()
    const first = startedGame(service)
    const second = startedGame(service)
    const order: string[] = []

    const slow = service.runGameCommand(first.id, async () => {
      order.push('slow:start')
      await new Promise((resolve) => setTimeout(resolve, 30))
      order.push('slow:end')
    })
    const fast = service.runGameCommand(second.id, async () => {
      order.push('fast')
    })

    await Promise.all([slow, fast])
    expect(order).toEqual(['slow:start', 'fast', 'slow:end'])
  })

  it('продолжает очередь после ошибки команды', async () => {
    const { service } = serviceWithGame()
    const game = startedGame(service)

    const failed = service.runGameCommand(game.id, async () => {
      throw new Error('storage unavailable')
    })
    const next = service.runGameCommand(game.id, async () => 'ok')

    await expect(failed).rejects.toThrow('storage unavailable')
    await expect(next).resolves.toBe('ok')
  })

  it('очищает очередь, когда в ней ничего не осталось', async () => {
    const { service } = serviceWithGame()
    const game = startedGame(service)

    await service.runGameCommand(game.id, async () => undefined)
    await service
      .runGameCommand(game.id, async () => {
        throw new Error('boom')
      })
      .catch(() => undefined)

    expect(service.pendingGameCommandCount()).toBe(0)
  })
})

describe('Удаление партии', () => {
  it('удаляет партию из реестра и хранилища', async () => {
    const { db, service } = serviceWithGame()
    const game = startedGame(service)
    await service.saveGame(game.id)
    expect(await db.getGame(game.id)).toBeTruthy()

    await service.deleteGame(game.id)

    expect(service.getGame(game.id)).toBeUndefined()
    expect(await db.getGame(game.id)).toBeNull()
  })

  it('не воскрешает запись сохранением, начатым во время удаления', async () => {
    const { db, service } = serviceWithGame()
    const game = startedGame(service)

    const gate = new Promise<void>((resolve) => setTimeout(resolve, 30))
    const originalSave = db.saveGame.bind(db)
    db.saveGame = async (gameId, state) => {
      await gate
      await originalSave(gameId, state)
    }

    const firstSave = service.saveGame(game.id)
    const deletion = service.deleteGame(game.id)
    // Пока удаление в полёте, партия уже не должна принимать сохранения
    const saveDuringDelete = service.saveGame(game.id)

    await Promise.all([firstSave, deletion, saveDuringDelete])

    expect(await db.getGame(game.id)).toBeNull()
    expect(service.getGame(game.id)).toBeUndefined()
  })

  it('удаляет партию, даже если сохранение в полёте упало', async () => {
    const { db, service } = serviceWithGame()
    const game = startedGame(service)

    const gate = new Promise<void>((resolve) => setTimeout(resolve, 20))
    db.saveGame = async () => {
      await gate
      throw new Error('storage unavailable')
    }

    const failedSave = service.saveGame(game.id)
    const deletion = service.deleteGame(game.id)

    await expect(deletion).resolves.toBeUndefined()
    await expect(failedSave).rejects.toThrow('storage unavailable')
    expect(service.getGame(game.id)).toBeUndefined()
    expect(await db.getGame(game.id)).toBeNull()
  })
})

describe('Сброс партий на диск', () => {
  it('дожидается сохранения, начатого во время сброса', async () => {
    const { db, service } = serviceWithGame()
    const game = startedGame(service)

    let savedDuringFlush: number | null = null
    db.saveGame = async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      savedDuringFlush = 2
    }

    const flushing = service.flushGames()
    // Ход компьютера или игрока успевает начать сохранение после старта сброса.
    const duringFlush = service.saveGame(game.id)
    await Promise.all([flushing, duringFlush])

    // Без повторного ожидания очереди запись осталась бы только в памяти.
    expect(savedDuringFlush).toBe(2)
  })

  it('останавливается, если очередь сохранений не опустошается', async () => {
    const { db, service } = serviceWithGame()
    const game = startedGame(service)

    db.saveGame = async () => {
      // Каждое сохранение ставит следующее: очередь не кончается никогда.
      void service.saveGame(game.id)
      await new Promise((resolve) => setTimeout(resolve, 5))
    }

    await expect(service.flushGames()).rejects.toThrow(
      'Pending game saves did not settle'
    )
  })
})

describe('Список партий', () => {
  it('берёт сохранённые партии из сводки и не разбирает их целиком', async () => {
    const { service } = serviceWithGame()
    const game = startedGame(service)
    game.roomCode = '111222'
    await service.saveGame(game.id)

    const summaries = await service.getGameSummaries()

    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({
      id: game.id,
      roomCode: '111222',
      gameIsStarted: true,
    })
  })

  it('показывает партию, чьё состояние читается не полностью', async () => {
    const db = new InMemoryGameDatabase()
    const service = new GameService(db)
    const game = startedGame(service)
    game.roomCode = '333444'
    const originalSave = db.saveGame.bind(db)

    // Повреждённая колода: заголовок партии цел, состояние — нет. Полный
    // разбор сохранения отверг бы запись и убрал партию из списка лобби.
    db.saveGame = async (gameId, serializedState) => {
      const parsed = JSON.parse(serializedState) as {
        state: Record<string, unknown>
      }
      parsed.state.tilesList = [{ id: 'broken' }]
      await originalSave(gameId, JSON.stringify(parsed))
    }
    await service.saveGame(game.id)

    const summaries = await service.getGameSummaries()

    expect(summaries[0]).toMatchObject({ id: game.id, roomCode: '333444' })
  })

  it('не дублирует партию, которая уже в памяти', async () => {
    const { service } = serviceWithGame()
    const game = startedGame(service)
    await service.saveGame(game.id)

    const summaries = await service.getGameSummaries()

    expect(summaries.filter(({ id }) => id === game.id)).toHaveLength(1)
  })
})

describe('Состояние хранилища', () => {
  it('считает партии, очередь и команды', async () => {
    const { service } = serviceWithGame()
    const game = startedGame(service)

    await service.saveGame(game.id)

    expect(service.storageStatus()).toMatchObject({
      games: 1,
      pendingSaves: 0,
      pendingCommands: 0,
      unreadableSaves: 0,
    })
  })

  it('считает непрочитанные сохранения вместо молчаливой потери', async () => {
    const db = new InMemoryGameDatabase()
    const service = new GameService(db)
    await db.saveGame('broken', '{invalid-json')

    await service.loadSavedGames()

    expect(service.storageStatus().unreadableSaves).toBe(1)
  })
})
