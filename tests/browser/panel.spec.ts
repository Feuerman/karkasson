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

test('расположение окон сохраняется и восстанавливается', async ({ page }) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    await startSinglePlayerGame(page, frontend.url)

    // Окна перетаскиваются в режиме настройки.
    await page.getByRole('button', { name: 'Настроить окна' }).click()

    const panel = page.locator('[data-draggable-id="player-stats"]')
    const before = await panel.boundingBox()
    if (!before) throw new Error('Панель партии не найдена')

    await page.mouse.move(before.x + 40, before.y + 12)
    await page.mouse.down()
    await page.mouse.move(before.x + 240, before.y + 132, { steps: 12 })
    await page.mouse.up()

    const after = await panel.boundingBox()
    if (!after) throw new Error('Панель партии потеряна')
    expect(after.x).toBeGreaterThan(before.x + 100)

    // Место окна сохранено в браузере.
    const saved = await page.evaluate(() => localStorage.getItem('panelLayout'))
    expect(saved).toContain('player-stats')

    // После перезагрузки окно возвращается на своё место.
    await page.reload()
    await page.getByRole('button', { name: 'Продолжить' }).click()
    await expect(
      page.getByTestId(TEST_IDS.gameStatsCurrentPlayer)
    ).toBeVisible()

    const restored = await panel.boundingBox()
    if (!restored) throw new Error('Панель партии не появилась')
    expect(Math.round(restored.x)).toBe(Math.round(after.x))
    expect(Math.round(restored.y)).toBe(Math.round(after.y))
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})

test('окно панели сворачивается и разворачивается', async ({ page }) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    await startSinglePlayerGame(page, frontend.url)

    const progress = page.getByTestId(TEST_IDS.gameStatsTilesProgress)
    await expect(progress).toBeVisible()

    const collapseButton = page.getByTestId(
      `${TEST_IDS.panelCollapse}-player-stats`
    )
    await collapseButton.click()
    await expect(progress).toBeHidden()

    await collapseButton.click()
    await expect(progress).toBeVisible()
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})

test('на узком экране окна сворачиваются сами', async ({ browser }) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined
  const context = await browser.newContext({
    viewport: { width: 480, height: 800 },
  })

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    const page = await context.newPage()
    await startSinglePlayerGame(page, frontend.url)

    // На узком экране панели мешают доске, поэтому свёрнуты.
    const progress = page.getByTestId(TEST_IDS.gameStatsTilesProgress)
    await expect(progress).toBeHidden()

    // Игрок может развернуть окно сам.
    await page.getByTestId(`${TEST_IDS.panelCollapse}-player-stats`).click()
    await expect(progress).toBeVisible()
  } finally {
    await context.close()
    await frontend?.close()
    await gameServer.close()
  }
})
