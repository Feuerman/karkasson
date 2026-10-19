import { expect, test } from '@playwright/test'
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

test('карточка партии показывает дополнение, возраст и копирует номер', async ({
  page,
}) => {
  const gameServer = createGameServer(new InMemoryDatabase(), {
    adminUI: false,
  })
  const serverPort = await listenOnRandomPort(gameServer.server)
  let frontend: RunningFrontend | undefined

  try {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    frontend = await startTestFrontend(`http://127.0.0.1:${serverPort}`)

    await page.goto(frontend.url)
    await page.getByTestId(TEST_IDS.lobbyCreateGame).click()
    await page.getByTestId(TEST_IDS.createGamePrincessDragon).check()
    await page.getByTestId(TEST_IDS.createGameSubmit).click()
    await expect(page.getByTestId(TEST_IDS.lobbyRoomHeading)).toBeVisible()

    // В комнате есть отдельные кнопки «Выйти из комнаты» и «Назад к списку».
    await expect(page.getByTestId(TEST_IDS.lobbyLeaveRoom)).toBeVisible()
    await expect(page.getByTestId(TEST_IDS.lobbyBackToList)).toBeVisible()

    // Возврат к списку не освобождает слот: комната остаётся в списке.
    await page.getByTestId(TEST_IDS.lobbyBackToList).click()
    await expect(page.getByTestId(TEST_IDS.lobbyCreateGame)).toBeVisible()

    // В карточке видно дополнение и давность партии.
    await expect(page.getByTestId('lobbyCardPrincessDragon')).toBeVisible()
    await expect(page.getByTestId('lobbyCardUpdated')).toContainText(
      'только что'
    )

    // Номер комнаты копируется и об этом сообщается.
    await page.getByTestId(TEST_IDS.lobbyCardCopyRoomCode).click()
    await expect(page.getByText('Скопировано')).toBeVisible()
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})

test('выход из комнаты отключает игрока, а слот остаётся за искусственным интеллектом', async ({
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
    await page.getByTestId(TEST_IDS.lobbyCreateGame).click()
    await page.getByTestId(TEST_IDS.createGameSubmit).click()
    // Второй слот занимает компьютер: комната остаётся в списке и после
    // выхода игрока.
    await page.getByTestId(TEST_IDS.playerSlotCheckbox).nth(1).click()
    await expect(page.getByTestId(TEST_IDS.lobbyRoomHeading)).toBeVisible()

    const game = gameServer.gameService.allGames()[0]
    expect(
      game?.players.filter((player) => player.socketId !== null)
    ).toHaveLength(1)

    await page.getByTestId(TEST_IDS.lobbyLeaveRoom).click()
    await expect(page.getByTestId(TEST_IDS.lobbyCreateGame)).toBeVisible()

    // Игрок отключился: его слот остаётся в комнате, но управляет им компьютер.
    await expect
      .poll(
        () => game?.players.filter((player) => player.socketId !== null).length
      )
      .toBe(0)
    expect(game?.players.filter((player) => player.name)).toHaveLength(2)
  } finally {
    await frontend?.close()
    await gameServer.close()
  }
})
