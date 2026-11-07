import { describe, expect, it, afterEach } from 'vitest'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'

describe('observability endpoints', () => {
  let running: RunningServer | null = null

  afterEach(async () => {
    if (running) {
      await stopTestServer(running)
      running = null
    }
  })

  it('GET /health возвращает ok для исправного сервера', async () => {
    running = await startTestServer()
    const res = await fetch(`${running.url}/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('GET /ready возвращает ready после загрузки сервера', async () => {
    running = await startTestServer()
    const res = await fetch(`${running.url}/ready`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ready')
  })

  it('GET /metrics отдаёт Prometheus-текст с типом контента text/plain', async () => {
    running = await startTestServer()
    // Сначала запрос, чтобы HTTP-метрика зарегистрировалась хотя бы с нулём.
    await fetch(`${running.url}/health`)
    const res = await fetch(`${running.url}/metrics`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    const text = await res.text()
    expect(text).toContain('# HELP http_requests_total')
    expect(text).toContain('# TYPE http_requests_total counter')
  })

  it('GET /health/details без токена возвращает 404', async () => {
    running = await startTestServer()
    const res = await fetch(`${running.url}/health/details`)
    expect(res.status).toBe(404)
  })

  it('отдаёт X-Request-Id из запроса в заголовке ответа', async () => {
    running = await startTestServer()
    const res = await fetch(`${running.url}/health`, {
      headers: { 'X-Request-Id': 'test-request-123' },
    })
    expect(res.headers.get('x-request-id')).toBe('test-request-123')
  })

  it('генерирует X-Request-Id, если клиент не прислал свой', async () => {
    running = await startTestServer()
    const res = await fetch(`${running.url}/health`)
    const requestId = res.headers.get('x-request-id')
    expect(requestId).toBeTruthy()
    expect(requestId!.length).toBeGreaterThan(0)
  })
})
