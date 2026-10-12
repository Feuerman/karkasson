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
