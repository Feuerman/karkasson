import { describe, expect, it } from 'vitest'
import { SocketEvents } from '@server/modules/types'
import { TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import { startTestServer, type RunningServer } from './helpers/server'
import { createLobby } from './helpers/lobby'

const STORAGE_FAILURE_SETTLE_MS = 900

describe('Сбои ходов компьютера', () => {
  let server: RunningServer | undefined
  const clients: TestClient[] = []

  registerIntegrationCleanup({
    getServer: () => server,
    clearServer: () => {
      server = undefined
    },
    disposeClients: () => {
      for (const client of clients) client.dispose()
      clients.length = 0
    },
  })

  /** Лобби, в котором все игровые места занимают компьютеры. */
  async function allComputerGame() {
    server = await startTestServer()
    const { gameId, creator } = await createLobby(server.url, {
      deviceId: 'device-spectator',
      computerOnly: true,
    })
    clients.push(creator)
    await creator.emitAck(SocketEvents.StartGame, { gameId })

    return { gameId, creator }
  }

  it('ошибка записи не удаляет партию игроков', async () => {
    const { gameId } = await allComputerGame()
    const service = server!.handle.gameService
    const gameBefore = service.getGame(gameId)
    const tilesBefore = Object.values(gameBefore?.tilePlacesStats ?? {}).reduce(
      (count, row) => count + Object.keys(row ?? {}).length,
      0
    )

    server!.db.saveError = new Error('storage unavailable')
    await new Promise((resolve) =>
      setTimeout(resolve, STORAGE_FAILURE_SETTLE_MS)
    )

    // Партия жива: транзиентная ошибка хранилища не имеет права уничтожить её
    expect(service.getGame(gameId)).toBeTruthy()

    // Незафиксированный ход откатан, состояние совпадает с последним сохранённым
    const tilesAfter = Object.values(
      service.getGame(gameId)?.tilePlacesStats ?? {}
    ).reduce((count, row) => count + Object.keys(row ?? {}).length, 0)
    expect(tilesAfter).toBe(tilesBefore)
  })

  it('после восстановления хранилища партия снова сохраняется', async () => {
    const { gameId } = await allComputerGame()
    const service = server!.handle.gameService

    server!.db.saveError = new Error('storage unavailable')
    await new Promise((resolve) =>
      setTimeout(resolve, STORAGE_FAILURE_SETTLE_MS)
    )
    expect(service.getGame(gameId)).toBeTruthy()

    server!.db.saveError = null
    await service.saveGame(gameId)
    expect(await server!.db.getGame(gameId)).toBeTruthy()
  })
})
