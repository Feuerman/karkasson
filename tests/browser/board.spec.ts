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
    if (rotation > 0) {
      await page.getByTestId(TEST_IDS.rotateTileClockwise).click()
      await page.waitForTimeout(150)
    }

    for (const [rowIndex, tileIndex] of neighbours) {
      await page.getByTestId(boardCellTestId(rowIndex, tileIndex)).click()
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

    await expect(previewImage).toHaveClass(/rotate-90/)
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
