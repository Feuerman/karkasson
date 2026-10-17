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

  it('сервер поднимает Socket.IO по HTTP', async () => {
    const handshake = await fetch(
      `${server!.url}/socket.io/?EIO=4&transport=polling`
    )
    expect(handshake.ok).toBe(true)
    // Открывающий пакет Engine.IO с идентификатором сессии
    expect(await handshake.text()).toMatch(/^0\{"sid":"[^"]+"/)
  })

  it('фронтенд отдаёт index.html с точкой монтирования', async () => {
    const response = await frontend!.fetch('/')
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('<div id="app"')
    expect(html).toContain('/src/main.js')
  })

  it('health-эндпоинт отдаёт состояние хранилища', async () => {
    const response = await fetch(`${server!.url}/health`)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'ok',
      storage: { unreadableSaves: 0 },
    })
  })

  it('фронтенд компилирует точку входа и корневой компонент', async () => {
    const main = await frontend!.fetch('/src/main.js')
    expect(main.status).toBe(200)
    const entry = await main.text()
    expect(entry).toContain('createApp')
    expect(entry).toContain('/src/App.vue')

    const app = await frontend!.fetch('/src/App.vue')
    expect(app.status).toBe(200)
    // Признак успешной компиляции однофайлового компонента плагином Vue
    expect(await app.text()).toContain('_sfc_main')
  })
})
