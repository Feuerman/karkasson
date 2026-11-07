import { expect, test } from '@playwright/test'
import type { AddressInfo } from 'node:net'
import { createRequire } from 'node:module'
import { TEST_IDS, boardCellTestId } from '@/data/testIds'
import {
  startTestFrontend,
  type RunningFrontend,
} from '../integration/helpers/frontend'

const require = createRequire(import.meta.url)
const { createGameServer } =
  require('../../server/dist/app.js') as typeof import('../../server/src/app')
const { InMemoryDatabase } =
  require('../integration/helpers/inMemoryDatabase') as typeof import('../integration/helpers/inMemoryDatabase')

async function listenOnRandomPort(server: import('node:http').Server) {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address() as AddressInfo | null
  if (!address) throw new Error('Тестовый сервер не получил порт')
  return address.port
}

test('после перезагрузки игрок возвращается в начатую партию', async ({
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
    await expect(page.getByTestId(TEST_IDS.connectionStatus)).toBeVisible()

    await page.getByTestId(TEST_IDS.lobbyCreateGame).click()
    await page.getByTestId(TEST_IDS.createGameSubmit).click()

    const availableSlots = page.getByTestId(TEST_IDS.playerSlotCheckbox)
    await expect(availableSlots).toHaveCount(6)
    for (let slot = 1; slot < 4; slot++) {
      await availableSlots.nth(slot).click()
    }

    await page.getByTestId(TEST_IDS.lobbyStartGame).click()
    await expect(page.getByTestId(boardCellTestId(15, 15))).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('lastGameId')))
      .toBeTruthy()

    await page.reload()

    // Авто-rejoin должен вернуть доску, а не список партий.
    await expect(page.getByTestId(boardCellTestId(15, 15))).toBeVisible({
      timeout: 20_000,
    })
    await expect(
      page.getByTestId(TEST_IDS.gameStatsCurrentPlayer)
    ).toContainText('Ваш ход')
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})
