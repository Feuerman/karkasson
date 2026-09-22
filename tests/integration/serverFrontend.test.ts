import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'
import { startTestFrontend, type RunningFrontend } from './helpers/frontend'

describe('Запуск сервера и фронтенда', () => {
  let server: RunningServer | undefined
  let frontend: RunningFrontend | undefined

  beforeAll(async () => {
    server = await startTestServer()
    frontend = await startTestFrontend(server.url)
  }, 60_000)

  afterAll(async () => {
    await frontend?.close()
    if (server) await stopTestServer(server)
  })

  it('сервер отвечает по HTTP и поднимает Engine.IO', async () => {
    const handshake = await fetch(
      `${server!.url}/socket.io/?EIO=4&transport=polling`
    )
    expect(handshake.ok).toBe(true)
    const text = await handshake.text()
    expect(text).toContain('0{')
  })

  it('фронтенд отдаёт index.html с точкой монтирования Vue', async () => {
    const response = await frontend!.fetch('/')
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('<div id="app">')
    expect(html).toContain('/src/main.js')
  })

  it('фронтенд компилирует точку входа и корневой компонент', async () => {
    const main = await frontend!.fetch('/src/main.js')
    expect(main.status).toBe(200)
    expect(await main.text()).toContain('createApp')

    const app = await frontend!.fetch('/src/App.vue')
    expect(app.status).toBe(200)
    expect(await app.text()).toContain('GameLobby')
  })
})
