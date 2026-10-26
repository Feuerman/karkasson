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

/**
 * Ставит тайл на доску.
 *
 * Выпавший тайл подходит не к каждой свободной клетке, поэтому перебираются
 * повороты и соседние клетки: успех виден по окну выставления подданного.
 * Поворачивается кнопкой в выбранной клетке: превью в панели после выбора
 * клетки скрыто.
 */
async function placeTileOnBoard(page: Page) {
  const skipFollower = page.getByRole('button', {
    name: 'Пропустить выставление',
  })
  const neighbours: [number, number][] = [
    [14, 15],
    [16, 15],
    [15, 14],
    [15, 16],
  ]

  for (let rotation = 0; rotation < 4; rotation += 1) {
    for (const [rowIndex, tileIndex] of neighbours) {
      await page.getByTestId(boardCellTestId(rowIndex, tileIndex)).click()
      if (rotation > 0) {
        await page.getByTestId(TEST_IDS.cellRotateTileClockwise).first().click()
        await page.waitForTimeout(150)
      }
      await page.getByTestId(TEST_IDS.placeTile).click()
      if (await skipFollower.isVisible().catch(() => false)) return
    }
  }

  throw new Error('Не удалось поставить тайл ни на одну свободную клетку')
}

test('доступные клетки подсвечены, а причину отказа видно без таймера', async ({
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

    // Стартовый тайл лежит в центре, а соседние клетки — доступные места.
    for (const [rowIndex, tileIndex] of [
      [14, 15],
      [16, 15],
      [15, 14],
      [15, 16],
    ]) {
      await expect(
        page.getByTestId(boardCellTestId(rowIndex, tileIndex))
      ).toHaveAttribute('data-available', 'true')
    }
    await expect(page.getByTestId(boardCellTestId(15, 15))).not.toHaveAttribute(
      'data-available',
      'true'
    )

    // Отказ по размещению объясняется рядом с кнопкой «Разместить».
    const farCell = page.getByTestId(boardCellTestId(10, 10))
    await farCell.click()
    await page.getByTestId(TEST_IDS.placeTile).click()

    const placementError = page.getByTestId(TEST_IDS.placementError)
    await expect(placementError).toBeVisible()
    await expect(placementError).toContainText('Невозможно разместить тайл')

    // Причину отказа снимает выбор другой клетки.
    await page.getByTestId(boardCellTestId(14, 15)).click()
    await expect(placementError).toHaveCount(0)
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})

test('тайл можно повернуть после выбора клетки', async ({ page }) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    await startSinglePlayerGame(page, frontend.url)

    const previewImage = page
      .getByTestId(TEST_IDS.pendingTilePreview)
      .locator('img')
    await expect(previewImage).toHaveClass(/rotate-0/)

    // На тач-устройстве наведения нет: кнопки поворота в клетке доступны
    // сразу после выбора клетки.
    await page.getByTestId(boardCellTestId(14, 15)).click()
    const cellRotateButton = page
      .getByTestId(TEST_IDS.cellRotateTileClockwise)
      .first()
    await expect(cellRotateButton).toBeVisible()
    await cellRotateButton.click()

    // Превью в выбранной клетке показывает тот же поворот.
    const ghostImage = page
      .getByTestId(boardCellTestId(14, 15))
      .locator('.tile-ghost-placed img')
    await expect(ghostImage).toHaveClass(/rotate-90/)
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})

test('отменённый выбор не оставляет следов на доске', async ({ page }) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    await startSinglePlayerGame(page, frontend.url)

    // Прежде чем клетка выбрана, панель подсказывает, что делать.
    await expect(page.getByTestId(TEST_IDS.pendingTilePreview)).toBeVisible()

    await page.getByTestId(boardCellTestId(14, 15)).click()
    await expect(
      page.getByTestId(boardCellTestId(14, 15)).locator('.tile-ghost-placed')
    ).toBeVisible()

    // Выбранная клетка: панель оставляет только кнопку «Разместить».
    await expect(page.getByTestId(TEST_IDS.pendingTilePreview)).toHaveCount(0)
    await expect(page.getByTestId(TEST_IDS.placeTile)).toBeEnabled()

    // Escape снимает выбор: ни плитки, ни рамки на клетке не остаётся.
    await page.keyboard.press('Escape')
    await expect(
      page.getByTestId(boardCellTestId(14, 15)).locator('.tile-ghost-placed')
    ).toHaveCount(0)
    await expect
      .poll(() =>
        page.evaluate(() => {
          const cell = document.querySelector(
            '[data-row-index="14"][data-tile-index="15"]'
          )
          return cell ? getComputedStyle(cell).outlineStyle : 'none'
        })
      )
      .toBe('none')

    // Панель возвращает подсказку, а кнопка снова ждёт выбора клетки.
    await expect(page.getByTestId(TEST_IDS.pendingTilePreview)).toBeVisible()
    await expect(page.getByTestId(TEST_IDS.placeTile)).toBeDisabled()
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})

test('о возврате хода сообщает уведомление', async ({ page }) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    await page.goto(frontend.url)
    await page.getByTestId(TEST_IDS.lobbyCreateGame).click()
    await page.getByTestId(TEST_IDS.createGameSubmit).click()
    // Второй слот занимает компьютер: после его хода очередь снова у игрока.
    await page.getByTestId(TEST_IDS.playerSlotCheckbox).nth(1).click()
    await page.getByTestId(TEST_IDS.lobbyStartGame).click()
    await expect(
      page.getByTestId(TEST_IDS.gameStatsCurrentPlayer)
    ).toContainText('Ваш ход')

    await placeTileOnBoard(page)
    await page.getByRole('button', { name: 'Пропустить выставление' }).click()

    const turnNotification = page.locator('[data-slot="title"]', {
      hasText: 'Ваш ход',
    })
    await expect(turnNotification).toBeVisible()
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})

test('показывает ход, сводку действия и управление звуком', async ({
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

    const tracker = page.getByTestId(TEST_IDS.turnTracker)
    await expect(tracker).toBeVisible()
    await expect(tracker).toContainText('Ваш ход')
    await expect(page.getByTestId(TEST_IDS.turnPhase)).toContainText(
      'Поставьте тайл'
    )

    const soundToggle = page.getByTestId(TEST_IDS.soundToggle)
    await expect(soundToggle).toHaveAttribute('aria-pressed', 'true')
    await soundToggle.click()
    await expect(soundToggle).toHaveAttribute('aria-pressed', 'false')
    expect(
      await page.evaluate(() => localStorage.getItem('soundEnabled'))
    ).toBe('false')

    await placeTileOnBoard(page)

    const summary = page.getByTestId(TEST_IDS.turnSummary)
    await expect(summary).toBeVisible()
    await expect(summary).toContainText('Тайл')
    await page.getByTestId(TEST_IDS.turnSummaryClose).click()
    await expect(summary).toHaveCount(0)
    await expect(page.locator('.tile-last-action')).toHaveCount(1)
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})

test('доска управляется с клавиатуры', async ({ page }) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    await startSinglePlayerGame(page, frontend.url)

    // Фокус стоит на клетке, стрелки перемещают его по доске.
    await page.getByTestId(boardCellTestId(15, 15)).focus()
    await page.keyboard.press('ArrowRight')
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.activeElement?.getAttribute('data-tile-index')
        )
      )
      .toBe('16')

    // Клавиша R поворачивает тайл.
    const previewImage = page
      .getByTestId(TEST_IDS.pendingTilePreview)
      .locator('img')
    await expect(previewImage).toHaveClass(/rotate-0/)
    await page.keyboard.press('r')
    await expect(previewImage).toHaveClass(/rotate-90/)

    // Enter выбирает клетку под фокусом.
    await page.keyboard.press('Enter')
    await expect(
      page.getByTestId(boardCellTestId(15, 16)).locator('.tile-ghost-placed')
    ).toBeVisible()

    // Escape снимает выбор.
    await page.keyboard.press('Escape')
    await expect(
      page.getByTestId(boardCellTestId(15, 16)).locator('.tile-ghost-placed')
    ).toHaveCount(0)
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})
