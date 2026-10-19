import { expect, test, type Page } from '@playwright/test'
import type { AddressInfo } from 'node:net'
import { createRequire } from 'node:module'
import { TEST_IDS } from '@/data/testIds'
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

/** Создаёт комнату, занимает слот и начинает партию одним игроком. */
async function startSinglePlayerGame(page: Page, url: string) {
  await page.goto(url)
  await page.getByTestId(TEST_IDS.lobbyCreateGame).click()
  await page.getByTestId(TEST_IDS.createGameSubmit).click()
  await page.getByTestId(TEST_IDS.lobbyStartGame).click()
  await expect(page.getByTestId(TEST_IDS.gameStatsCurrentPlayer)).toContainText(
    'Ваш ход'
  )
}

test('панель партии показывает прогресс и отмечает игрока', async ({
  page,
}) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    await startSinglePlayerGame(page, frontend.url)

    // На доске стоит стартовый тайл, в колоде ждут остальные.
    await expect(
      page.getByTestId(TEST_IDS.gameStatsTilesProgress)
    ).toContainText('1 / 72')

    // Игрок, за которым сидит браузер, отмечен в таблице счёта.
    const ownPlayer = page.getByTestId(TEST_IDS.gameStatsOwnPlayer)
    await expect(ownPlayer).toContainText('Вы')

    // Таймер хода идёт: время хода показывается в панели.
    const turnTimer = page.getByTestId(TEST_IDS.gameStatsTurnTimer)
    await expect(turnTimer).toBeVisible()
    await expect(turnTimer).toHaveText(/^\d+:\d{2}$/)
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})

test('масштаб доски меняется кнопками', async ({ page }) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    await startSinglePlayerGame(page, frontend.url)

    const zoomValue = page.getByTestId(TEST_IDS.zoomValue)
    await expect(zoomValue).toHaveText('100%')

    await page.getByTestId(TEST_IDS.zoomIn).click()
    await expect(zoomValue).toHaveText('125%')

    await page.getByTestId(TEST_IDS.zoomOut).click()
    await expect(zoomValue).toHaveText('100%')

    // Кнопка с числом возвращает единичный масштаб.
    await page.getByTestId(TEST_IDS.zoomIn).click()
    await expect(zoomValue).toHaveText('125%')
    await zoomValue.click()
    await expect(zoomValue).toHaveText('100%')
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})
