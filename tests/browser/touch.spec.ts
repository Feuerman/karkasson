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

/** Создаёт комнату и начинает партию одним игроком. */
async function startSinglePlayerGame(page: Page, url: string) {
  await page.goto(url)
  await page.getByTestId(TEST_IDS.lobbyCreateGame).click()
  await page.getByTestId(TEST_IDS.createGameSubmit).click()
  await page.getByTestId(TEST_IDS.lobbyStartGame).click()
  await expect(page.getByTestId(TEST_IDS.gameStatsCurrentPlayer)).toContainText(
    'Ваш ход'
  )
}

test('доска панорамируется касанием', async ({ browser }) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1280, height: 720 },
  })

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    const page = await context.newPage()
    await startSinglePlayerGame(page, frontend.url)

    const scrollLeft = await page.evaluate(() => {
      const board = document.querySelector('.board-surface')
      if (!board) return null

      const makeTouch = (clientX: number, clientY: number) =>
        new Touch({ identifier: 1, target: board, clientX, clientY })

      board.dispatchEvent(
        new TouchEvent('touchstart', {
          touches: [makeTouch(300, 300)],
          bubbles: true,
          cancelable: true,
        })
      )
      board.dispatchEvent(
        new TouchEvent('touchmove', {
          touches: [makeTouch(200, 200)],
          bubbles: true,
          cancelable: true,
        })
      )
      board.dispatchEvent(
        new TouchEvent('touchend', { touches: [], bubbles: true })
      )

      return board.scrollLeft
    })

    expect(scrollLeft).toBeGreaterThan(0)
  } finally {
    await context.close()
    await frontend?.close()
    await gameServer.close()
  }
})

test('окно перетаскивается касанием', async ({ browser }) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1280, height: 720 },
  })

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    const page = await context.newPage()
    await startSinglePlayerGame(page, frontend.url)

    // Окна перетаскиваются в режиме настройки.
    await page.getByRole('button', { name: 'Настроить окна' }).click()

    const panel = page.locator('[data-draggable-id="player-stats"]')
    const before = await panel.boundingBox()
    if (!before) throw new Error('Панель партии не найдена')

    await page.evaluate(
      ({ x, y }) => {
        const target = document.querySelector(
          '[data-draggable-id="player-stats"]'
        )
        if (!target) return

        const makeEvent = (type: string, clientX: number, clientY: number) =>
          new PointerEvent(type, {
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            button: 0,
            clientX,
            clientY,
            bubbles: true,
            cancelable: true,
          })

        target.dispatchEvent(makeEvent('pointerdown', x, y))
        document.dispatchEvent(makeEvent('pointermove', x + 120, y + 60))
        document.dispatchEvent(makeEvent('pointerup', x + 120, y + 60))
      },
      { x: before.x + 40, y: before.y + 12 }
    )

    const after = await panel.boundingBox()
    if (!after) throw new Error('Панель партии потеряна')
    expect(after.x).toBeGreaterThan(before.x + 60)
  } finally {
    await context.close()
    await frontend?.close()
    await gameServer.close()
  }
})
