import { expect, test } from '@playwright/test'
import type { AddressInfo } from 'node:net'
import { createGameServer } from '../../server/src/app'
import { InMemoryDatabase } from '../integration/helpers/inMemoryDatabase'
import {
  startTestFrontend,
  type RunningFrontend,
} from '../integration/helpers/frontend'

async function listenOnRandomPort(server: import('node:http').Server) {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address() as AddressInfo | null
  if (!address) throw new Error('Тестовый сервер не получил порт')
  return address.port
}

test('игрок создаёт лобби, занимает слот и начинает партию', async ({
  page,
}) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)

    await page.goto(frontend.url)
    const createGameButton = page.getByRole('button', {
      name: 'Создать новую игру',
    })
    await expect(createGameButton).toBeVisible()
    await createGameButton.click()

    await expect(
      page.getByRole('button', { name: 'Начать игру' })
    ).toBeVisible()
    await expect.poll(() => gameServer.gameService.allGames().length).toBe(1)

    const availableSlots = page.getByRole('checkbox')
    await expect(availableSlots).toHaveCount(8)
    for (let slot = 1; slot < 4; slot++) {
      await availableSlots.nth(slot).click()
    }
    await expect
      .poll(() => {
        const game = gameServer.gameService.allGames()[0]
        return game?.players.filter((player) => player.name).length ?? 0
      })
      .toBe(4)

    await page.getByRole('button', { name: 'Начать игру' }).click()
    await expect(
      page.locator("[data-row-index='15'][data-tile-index='15']")
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Выйти из игры' })
    ).toBeVisible()
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})
