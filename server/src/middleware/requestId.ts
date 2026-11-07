import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

export interface RequestWithId extends Request {
  requestId?: string
}

/** Генерирует requestId для каждого HTTP-запроса и отдаёт его в заголовке ответа. */
export function requestIdMiddleware() {
  return (
    request: RequestWithId,
    response: Response,
    next: NextFunction
  ): void => {
    const requestId =
      (typeof request.header === 'function'
        ? request.header('X-Request-Id')
        : undefined) || randomUUID()
    request.requestId = requestId
    response.setHeader('X-Request-Id', requestId)
    next()
  }
}

export function getRequestId(request: RequestWithId): string | undefined {
  return request.requestId
}
