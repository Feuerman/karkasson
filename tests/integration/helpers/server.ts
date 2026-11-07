import type { AddressInfo } from 'node:net'
import {
  createGameServer,
  type CreateGameServerOptions,
  type GameServerHandle,
} from '@server/app'
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
 * Поднимает настоящий игровой сервер (Socket.IO + HTTP) на указанном порту
 * с файрбезовским хранилищем, заменённым на in-memory. Порт 0 означает
 * случайный свободный порт.
 */
export async function startTestServerAtPort(
  port: number,
  store: InMemoryStore = createInMemoryStore(),
  options: Omit<CreateGameServerOptions, 'adminUI'> = {}
): Promise<RunningServer> {
  const db = new InMemoryDatabase(store)
  const handle = createGameServer(db, { ...options, adminUI: false })

  await new Promise<void>((resolve) => {
    handle.server.listen(port, '127.0.0.1', resolve)
  })

  const address = handle.server.address() as AddressInfo
  const actualPort = address.port
  const url = `http://127.0.0.1:${actualPort}`

  return { handle, port: actualPort, url, db, store }
}

/** Поднимает сервер на случайном свободном порту. */
export async function startTestServer(
  store: InMemoryStore = createInMemoryStore(),
  options: Omit<CreateGameServerOptions, 'adminUI'> = {}
): Promise<RunningServer> {
  return startTestServerAtPort(0, store, options)
}

export async function stopTestServer(running: RunningServer): Promise<void> {
  await running.handle.close()
}
