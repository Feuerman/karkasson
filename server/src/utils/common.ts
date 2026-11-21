export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** Plain object: не null, не массив, typeof === 'object'. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
