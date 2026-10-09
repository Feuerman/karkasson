import { expect, test } from '@playwright/test'
import type { AddressInfo } from 'node:net'
import { createRequire } from 'node:module'
import { TEST_IDS, boardCellTestId } from '@/data/testIds'
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
    const createGameButton = page.getByTestId(TEST_IDS.lobbyCreateGame)
    await expect(createGameButton).toBeVisible()
    await createGameButton.click()

    const createGameModalTitle = page.getByTestId(TEST_IDS.createGameModalTitle)
    await expect(createGameModalTitle).toBeVisible()
    await expect(createGameModalTitle).toContainText('Создание игры')

    const finalScoringCheckbox = page.getByTestId(
      TEST_IDS.createGameFinalScoring
    )
    const princessAndDragonCheckbox = page.getByTestId(
      TEST_IDS.createGamePrincessDragon
    )
    await expect(finalScoringCheckbox).not.toBeChecked()
    await expect(princessAndDragonCheckbox).not.toBeChecked()
    await expect(
      page.getByTestId(TEST_IDS.createGameTestModeNote)
    ).toContainText(
      'Тестовый режим: возможны небольшие несоответствия в игровой логике.'
    )
    await finalScoringCheckbox.check()
    await princessAndDragonCheckbox.check()
    await page.getByTestId(TEST_IDS.createGameSubmit).click()

    const startGameButton = page.getByTestId(TEST_IDS.lobbyStartGame)
    await expect(startGameButton).toBeVisible()
    const roomHeading = page.getByTestId(TEST_IDS.lobbyRoomHeading)
    await expect(roomHeading).toBeVisible()
    await expect(roomHeading).toContainText(/Комната № \d{6}/)
    await expect(
      page.getByTestId(TEST_IDS.lobbyPrincessDragonStatus)
    ).toContainText('включены')
    await expect.poll(() => gameServer.gameService.allGames().length).toBe(1)
    expect(gameServer.gameService.allGames()[0]?.finalScoringEnabled).toBe(true)
    expect(
      gameServer.gameService.allGames()[0]?.rules.expansions.princessAndDragon
    ).toBe(true)

    const availableSlots = page.getByTestId(TEST_IDS.playerSlotCheckbox)
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

    await startGameButton.click()
    const currentPlayerLabel = page.getByTestId(TEST_IDS.gameStatsCurrentPlayer)
    await expect(currentPlayerLabel).toBeVisible()
    await expect(currentPlayerLabel).toContainText('Ваш ход')
    await expect(page.getByTestId(boardCellTestId(15, 15))).toBeVisible()
    await expect(page.getByTestId(TEST_IDS.gameExit)).toBeVisible()
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
    await creatorPage.getByTestId(TEST_IDS.lobbyCreateGame).click()
    await creatorPage.getByTestId(TEST_IDS.createGameSubmit).click()
    const creatorRoomHeading = creatorPage.getByTestId(
      TEST_IDS.lobbyRoomHeading
    )
    await expect(creatorRoomHeading).toBeVisible()
    await expect(creatorRoomHeading).toContainText(/Комната № \d{6}/)

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
    const roomSearch = guestPage.getByTestId(TEST_IDS.lobbyRoomSearch)
    await expect(roomSearch).toBeVisible()
    await roomSearch.fill(roomCode)
    await roomSearch.press('Enter')
    const guestRoomHeading = guestPage.getByTestId(TEST_IDS.lobbyRoomHeading)
    await expect(guestRoomHeading).toBeVisible()
    await expect(guestRoomHeading).toContainText(`Комната № ${roomCode}`)
    const guestDeviceId = await guestPage.evaluate(() =>
      localStorage.getItem('deviceId')
    )
    expect(guestDeviceId).not.toBe(creatorDeviceId)
    await expect(guestPage.getByTestId(TEST_IDS.lobbyStartGame)).toHaveCount(0)
  } finally {
    await creatorContext.close()
    await guestContext.close()
    await frontend?.close()
    await gameServer.close()
  }
})
