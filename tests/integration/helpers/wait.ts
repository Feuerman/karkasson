/** Ожидание состояния, которое наступает само: сервер, ИИ и хранилище асинхронны. */

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  description: string,
  timeoutMs = 5_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await condition()) return
    await sleep(20)
  }
  throw new Error(`Таймаут ожидания: ${description}`)
}
