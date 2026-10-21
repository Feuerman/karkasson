import { expect, test, type Page } from '@playwright/test'
import type { AddressInfo } from 'node:net'
import { createRequire } from 'node:module'
import { TEST_IDS } from '@/data/testIds'
import { formatGameData } from '@server/services/gameView'
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

/** Создаёт комнату с игроком и компьютером и начинает партию. */
async function startGameWithComputer(page: Page, url: string) {
  await page.goto(url)
  await page.getByTestId(TEST_IDS.lobbyCreateGame).click()
  await page.getByTestId(TEST_IDS.createGameSubmit).click()
  await page.getByTestId(TEST_IDS.playerSlotCheckbox).nth(1).click()
  await page.getByTestId(TEST_IDS.lobbyStartGame).click()
  await expect(page.getByTestId(TEST_IDS.gameStatsCurrentPlayer)).toContainText(
    'Ваш ход'
  )
}

test('итоги партии показывают таблицу очков и действия', async ({ page }) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    await startGameWithComputer(page, frontend.url)

    // Полная партия ради экрана итогов не нужна: партия завершается
    // на стороне сервера, а клиент получает итоговый снимок.
    const game = gameServer.gameService.allGames()[0]
    if (!game?.id) throw new Error('Партия не создана')
    const [human, computer] = game.players
    game.scores[human.id] = 25
    game.scores[computer.id] = 18
    game.gameIsEnded = true
    game.winnerPlayerIds = [human.id]
    gameServer.events.publishGameUpdated(game.id, formatGameData(game))

    const overlay = page.getByTestId(TEST_IDS.gameResultOverlay)
    await expect(overlay).toBeVisible()

    const rows = page.getByTestId(TEST_IDS.gameResultRow)
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toContainText(human.name ?? '')
    await expect(rows.first()).toContainText('25')
    await expect(rows.nth(1)).toContainText('18')

    await expect(page.getByTestId(TEST_IDS.gameResultGoLobby)).toBeVisible()
    await expect(page.getByTestId(TEST_IDS.gameResultPlayAgain)).toBeVisible()

    // Окно итогов можно закрыть и посмотреть на доску.
    await page.getByTestId(TEST_IDS.gameResultClose).click()
    await expect(overlay).toHaveCount(0)
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})

test('кнопка «Сыграть ещё» начинает новую партию с теми же правилами', async ({
  page,
}) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined

  try {
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)
    await startGameWithComputer(page, frontend.url)

    const game = gameServer.gameService.allGames()[0]
    if (!game?.id) throw new Error('Партия не создана')
    game.gameIsEnded = true
    game.winnerPlayerIds = [game.players[0].id]
    gameServer.events.publishGameUpdated(game.id, formatGameData(game))

    await expect(page.getByTestId(TEST_IDS.gameResultOverlay)).toBeVisible()
    await page.getByTestId(TEST_IDS.gameResultPlayAgain).click()

    // Новая партия создаётся с теми же правилами, игрок снова в лобби комнаты.
    await expect(page.getByTestId(TEST_IDS.lobbyStartGame)).toBeVisible()
    await expect(page.getByTestId(TEST_IDS.gameResultOverlay)).toHaveCount(0)
    expect(gameServer.gameService.allGames()).toHaveLength(2)
    const created = gameServer.gameService.allGames()[1]
    expect(created?.finalScoringEnabled).toBe(
      game.finalScoringEnabled as boolean
    )
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})
