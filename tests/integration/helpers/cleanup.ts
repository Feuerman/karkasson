import { afterEach } from 'vitest'
import { stopTestServer, type RunningServer } from './server'

interface IntegrationCleanupOptions {
  getServer: () => RunningServer | undefined
  clearServer: () => void
  disposeClients: () => void
}

export function registerIntegrationCleanup({
  getServer,
  clearServer,
  disposeClients,
}: IntegrationCleanupOptions): void {
  afterEach(async () => {
    disposeClients()

    const server = getServer()
    if (!server) return

    await stopTestServer(server)
    clearServer()
  })
}
