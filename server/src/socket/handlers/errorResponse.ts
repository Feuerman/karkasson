import { errorCodeForMessage } from '../../modules/errors'

/** Безопасный ack: текст из каталога и стабильный машинный код. */
export function errorResponse(
  message: string,
  details: Record<string, unknown> = {}
): { error: string; code: string; [key: string]: unknown } {
  return {
    ...details,
    error: message,
    code: errorCodeForMessage(message),
  }
}
