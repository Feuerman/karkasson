import { expect, test } from '@playwright/test'
import type { AddressInfo } from 'node:net'
import { createRequire } from 'node:module'
import { InMemoryDatabase } from '../integration/helpers/inMemoryDatabase'
import {
  startTestFrontend,
  type RunningFrontend,
} from '../integration/helpers/frontend'

const require = createRequire(import.meta.url)
const { createGameServer } =
  require('../../server/dist/app.js') as typeof import('../../server/src/app')

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
      page.getByRole('heading', { name: 'Создание игры' })
    ).toBeVisible()

    const finalScoringCheckbox = page.getByRole('checkbox', {
      name: 'Финальный подсчёт очков',
    })
    await expect(finalScoringCheckbox).not.toBeChecked()
    await finalScoringCheckbox.check()
    await page.getByRole('button', { name: 'Создать игру' }).click()

    await expect(
      page.getByRole('button', { name: 'Начать игру' })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /Комната № \d{6}/ })
    ).toBeVisible()
    await expect.poll(() => gameServer.gameService.allGames().length).toBe(1)
    expect(gameServer.gameService.allGames()[0]?.finalScoringEnabled).toBe(true)

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
    await expect(page.getByText('Ваш ход')).toBeVisible()
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

test('игрок находит комнату и подключается по её номеру', async ({
  browser,
}) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined
  const creatorContext = await browser.newContext()
  const guestContext = await browser.newContext()

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    const creatorPage = await creatorContext.newPage()
    await creatorPage.goto(frontend.url)
    await creatorPage
      .getByRole('button', { name: 'Создать новую игру' })
      .click()
    await creatorPage.getByRole('button', { name: 'Создать игру' }).click()
    await expect(
      creatorPage.getByRole('heading', { name: /Комната № \d{6}/ })
    ).toBeVisible()

    const roomCode = gameServer.gameService.allGames()[0]?.roomCode
    if (!roomCode) throw new Error('Номер комнаты не создан')
    const creatorDeviceId = await creatorPage.evaluate(() =>
      localStorage.getItem('deviceId')
    )

    const guestPage = await guestContext.newPage()
    await guestPage.addInitScript(() => {
      localStorage.setItem('deviceId', 'unrelated-guest-device')
    })
    await guestPage.goto(frontend.url)
    const roomSearch = guestPage.getByRole('searchbox', {
      name: 'Найти комнату по номеру',
    })
    await expect(roomSearch).toBeVisible()
    await roomSearch.fill(roomCode)
    await roomSearch.press('Enter')
    await expect(
      guestPage.getByRole('heading', { name: `Комната № ${roomCode}` })
    ).toBeVisible()
    const guestDeviceId = await guestPage.evaluate(() =>
      localStorage.getItem('deviceId')
    )
    expect(guestDeviceId).not.toBe(creatorDeviceId)
    await expect(
      guestPage.getByRole('button', { name: 'Начать игру' })
    ).toHaveCount(0)
  } finally {
    await creatorContext.close()
    await guestContext.close()
    await frontend?.close()
    await gameServer.close()
  }
})
