import type { NextFunction, Request, Response } from 'express'
import { metrics } from '../metrics/registry'

const httpRequestsTotal = metrics.counter(
  'http_requests_total',
  'Total number of HTTP requests'
)
const httpRequestDuration = metrics.histogram(
  'http_request_duration_seconds',
  'HTTP request duration in seconds'
)

/** Считает количество HTTP-запросов и длительность по маршруту/статусу. */
export function httpMetricsMiddleware() {
  return (request: Request, response: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint()
    response.on('finish', () => {
      const duration = Number(process.hrtime.bigint() - start) / 1e9
      const route =
        (request.route as { path?: string } | undefined)?.path ?? request.path
      const status = String(response.statusCode)
      httpRequestsTotal.inc(1, { method: request.method, route, status })
      httpRequestDuration.observe(duration, {
        method: request.method,
        route,
      })
    })
    next()
  }
}
