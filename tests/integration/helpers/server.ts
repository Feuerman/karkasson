import type { AddressInfo } from 'node:net'
import {
  createGameServer,
  type GameServerHandle,
} from '../../../server/src/app'
import {
  createInMemoryStore,
  InMemoryDatabase,
  type InMemoryStore,
} from './inMemoryDatabase'

export interface RunningServer {
  handle: GameServerHandle
  port: number
  url: string
  db: InMemoryDatabase
  store: InMemoryStore
}

/**
 * Поднимает настоящий игровой сервер (Socket.IO + HTTP) на случайном порту
 * с файрбезовским хранилищем, заменённым на in-memory.
 */
export async function startTestServer(
  store: InMemoryStore = createInMemoryStore()
): Promise<RunningServer> {
  const db = new InMemoryDatabase(store)
  const handle = createGameServer(db, { adminUI: false })

  await new Promise<void>((resolve) => {
    handle.server.listen(0, '127.0.0.1', resolve)
  })

  const address = handle.server.address() as AddressInfo
  const port = address.port
  const url = `http://127.0.0.1:${port}`

  return { handle, port, url, db, store }
}

export async function stopTestServer(running: RunningServer): Promise<void> {
  await running.handle.close()
}
