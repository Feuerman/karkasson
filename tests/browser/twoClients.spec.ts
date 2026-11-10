import { expect, test, type Page } from '@playwright/test'
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

/** Закрывает подсказку обучения, если она перекрывает элементы доски. */
async function dismissOnboardingHint(page: Page) {
  const skip = page.getByRole('button', { name: 'Пропустить обучение' })
  if (await skip.isVisible().catch(() => false)) {
    await skip.click()
  }
}

/** Ставит первый подходящий тайл на свободную соседующую клетку. */
async function placeOneTile(page: Page) {
  // Ждём, пока игра отрендерит подсказку с выпавшим тайлом: без неё клетки
  // ещё не активны, и клик по ним игнорируется.
  await expect(page.getByTestId(TEST_IDS.pendingTilePreview)).toBeVisible()

  const neighbours: [number, number][] = [
    [14, 15],
    [16, 15],
    [15, 14],
    [15, 16],
  ]
  const skipFollower = page.getByRole('button', {
    name: 'Пропустить выставление',
  })

  for (let rotation = 0; rotation < 4; rotation += 1) {
    for (const [rowIndex, tileIndex] of neighbours) {
      await page.getByTestId(boardCellTestId(rowIndex, tileIndex)).click()
      if (rotation > 0) {
        await page.getByTestId(TEST_IDS.cellRotateTileClockwise).first().click()
        await page.waitForTimeout(150)
      }
      await page.getByTestId(TEST_IDS.placeTile).click()
      if (await skipFollower.isVisible().catch(() => false)) {
        await dismissOnboardingHint(page)
        return
      }
    }
  }
  throw new Error('Не удалось поставить тайл ни на одну свободную клетку')
}

/** Завершает ход: убирает подданного и закрывает сводку действия. */
async function endTurn(page: Page) {
  const skipFollower = page.getByRole('button', {
    name: 'Пропустить выставление',
  })
  if (await skipFollower.isVisible().catch(() => false)) {
    await skipFollower.click()
  }
  await dismissOnboardingHint(page)

  const summary = page.getByTestId(TEST_IDS.turnSummary)
  if (await summary.isVisible().catch(() => false)) {
    await page.getByTestId(TEST_IDS.turnSummaryClose).click()
  }
}

async function playTurn(page: Page) {
  await dismissOnboardingHint(page)
  await placeOneTile(page)
  await endTurn(page)
}

test('два клиента в одной партии по очереди ставят тайлы', async ({
  browser,
}, testInfo) => {
  if (testInfo.project.name !== 'chromium') {
    test.skip(
      true,
      'Стабилен только в Chromium; Firefox и WebKit не укладываются в таймаут размещения хода; кросс-браузерность остальных сценариев — через проекты в playwright.config.ts.'
    )
    return
  }
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined
  const creatorContext = await browser.newContext()
  const guestContext = await browser.newContext()

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)

    // Клиент 1 создаёт комнату (хост, слот 0).
    const creatorPage = await creatorContext.newPage()
    await creatorPage.addInitScript(() => {
      localStorage.setItem('locale', 'ru')
    })
    await creatorPage.goto(frontend.url)
    await creatorPage.getByTestId(TEST_IDS.lobbyCreateGame).click()
    await creatorPage.getByTestId(TEST_IDS.createGameSubmit).click()
    await expect(
      creatorPage.getByTestId(TEST_IDS.lobbyRoomHeading)
    ).toBeVisible()

    const roomCode = gameServer.gameService.allGames()[0]?.roomCode
    if (!roomCode) throw new Error('Номер комнаты не создан')

    // Клиент 2 находит комнату по номеру и занимает слот 1.
    const guestPage = await guestContext.newPage()
    await guestPage.addInitScript(() => {
      localStorage.setItem('locale', 'ru')
    })
    await guestPage.goto(frontend.url)
    const roomSearch = guestPage.getByTestId(TEST_IDS.lobbyRoomSearch)
    await expect(roomSearch).toBeVisible()
    await roomSearch.fill(roomCode)
    await roomSearch.press('Enter')
    await expect(guestPage.getByTestId(TEST_IDS.lobbyRoomHeading)).toBeVisible()
    await expect(
      guestPage.getByTestId(TEST_IDS.lobbyRoomHeading)
    ).toContainText(`Комната № ${roomCode}`)
    await expect
      .poll(
        () =>
          gameServer.gameService
            .allGames()[0]
            ?.players.filter((player) => player.sessionId).length ?? 0
      )
      .toBe(2)

    // Клиент 1 начинает партию.
    await creatorPage.getByTestId(TEST_IDS.lobbyStartGame).click()
    await expect
      .poll(() => gameServer.gameService.allGames()[0]?.gameIsStarted)
      .toBe(true)
    await expect(
      creatorPage.getByTestId(TEST_IDS.gameStatsCurrentPlayer)
    ).toContainText('Ваш ход')
    await expect(creatorPage.getByTestId(boardCellTestId(15, 15))).toBeVisible()

    // Клиент 1 делает ход — очередь переходит к клиенту 2.
    await playTurn(creatorPage)
    await expect
      .poll(
        async () => {
          const text = await guestPage
            .getByTestId(TEST_IDS.gameStatsCurrentPlayer)
            .textContent()
          return text ?? ''
        },
        { timeout: 30_000 }
      )
      .toContain('Ваш ход')

    // Клиент 2 делает ход — очередь возвращается к клиенту 1.
    await playTurn(guestPage)
    await expect
      .poll(
        async () => {
          const text = await guestPage
            .getByTestId(TEST_IDS.gameStatsCurrentPlayer)
            .textContent()
          return text ?? ''
        },
        { timeout: 30_000 }
      )
      .not.toContain('Ваш ход')
    await expect(guestPage.locator('.tile-last-action').first()).toBeVisible({
      timeout: 30_000,
    })
  } finally {
    await creatorContext.close()
    await guestContext.close()
    await frontend?.close()
    await gameServer.close()
  }
})
