export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))
