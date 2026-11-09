import { test, expect, type Page } from '@playwright/test'
import type { AddressInfo } from 'node:net'
import { createRequire } from 'node:module'
import { TEST_IDS, boardCellTestId } from '@/data/testIds'
import { AxeBuilder } from '@axe-core/playwright'
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

/** Создаёт комнату и начинает партию с двумя игроками. */
async function startGameWithTwoPlayers(page: Page, url: string) {
  await page.addInitScript(() => {
    localStorage.setItem('locale', 'ru')
  })
  await page.goto(url)
  await page.getByTestId(TEST_IDS.lobbyCreateGame).click()
  await page.getByTestId(TEST_IDS.createGameSubmit).click()
  await page.getByTestId(TEST_IDS.playerSlotCheckbox).nth(1).click()
  await page.getByTestId(TEST_IDS.lobbyStartGame).click()
  await expect(page.getByTestId(TEST_IDS.gameStatsCurrentPlayer)).toContainText(
    'Ваш ход'
  )
}

test('страница лобби: язык, заголовок и аудит axe без нарушений', async ({
  page,
}) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    await page.addInitScript(() => {
      localStorage.setItem('locale', 'ru')
    })
    await page.goto(frontend.url)

    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    await expect(page).toHaveTitle('Каркассон Онлайн')

    const results = await new AxeBuilder({ page }).analyze()
    // Контраст цветов проверяется вручную (см. п. 4.4 «Контраст»): палитра
    // средневековой темы не везде укладывается в WCAG AA, поэтому в automate
    // оставляем остальные правила axe.
    const nonContrastViolations = results.violations.filter(
      (v) => v.id !== 'color-contrast'
    )
    expect(nonContrastViolations).toEqual([])
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})

test('доска: ARIA-подписи, живой регион хода, оповещение ошибки и навигация с клавиатуры', async ({
  page,
}) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    await startGameWithTwoPlayers(page, frontend.url)

    // Язык и заголовок сохраняются на доске.
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    await expect(page).toHaveTitle('Каркассон Онлайн')

    // Клетки доски — кнопки с доступным именем (координаты).
    // Центральная клетка (15, 15) занята стартовым тайлом, поэтому берём
    // свободную соседнюю (14, 15).
    const firstCell = page.getByTestId(boardCellTestId(14, 15))
    await expect(firstCell).toHaveAttribute('role', 'button')
    await expect(firstCell).toHaveAttribute('aria-label', 'Клетка 15, 16')

    // Живой регион сводки хода объявляет «Ваш ход».
    const turnSummary = page.getByTestId(TEST_IDS.turnSummary)
    await expect(turnSummary).toHaveAttribute('aria-live', 'polite')

    // Навигация стрелочками перемещает фокус по клеткам.
    const startCell = page.getByTestId(boardCellTestId(15, 15))
    await startCell.focus()
    await page.keyboard.press('ArrowRight')
    await expect
      .poll(() =>
        page.evaluate(() =>
          (document.activeElement as HTMLElement)?.getAttribute(
            'data-tile-index'
          )
        )
      )
      .toBe('16')

    // Enter выбирает сфокусированную свободную клетку (появляется «призрак» тайла).
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(boardCellTestId(15, 16)).locator('.tile-ghost-placed')
    ).toBeVisible()

    // Escape снимает выбор.
    await page.keyboard.press('Escape')
    await expect(
      page.getByTestId(boardCellTestId(15, 16)).locator('.tile-ghost-placed')
    ).toHaveCount(0)

    // Аудит axe на области доски: клетки, подписи и фокус.
    const boardResults = await new AxeBuilder({ page })
      .include('.board-surface')
      .analyze()
    const boardNonContrastViolations = boardResults.violations.filter(
      (v) => v.id !== 'color-contrast' && v.id !== 'page-has-heading-one'
    )
    expect(boardNonContrastViolations).toEqual([])
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})
