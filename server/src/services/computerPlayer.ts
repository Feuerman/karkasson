import { COMPUTER_MOVE_DELAY_MS, PLAYER_RECONNECT_TIMEOUT_MS } from '../config'
import type { IGameBoard } from '../modules/GameManager'
import { type Player, type PlayerId } from '../modules/types'
import { sleep } from '../utils/common'
import type { GameService } from './GameService'
import type { GameEventsPublisher } from './gameEvents'

export function isComputerPlayer(player: Player): boolean {
  return !player.socketId && !player.deviceId
}

export function resumeComputerGames(
  events: GameEventsPublisher,
  service: GameService,
  reconnectTimeoutMs?: number
): void {
  service.allGames().forEach((game) => {
    if (!game.id) return
    if (!game.gameIsStarted || game.gameIsEnded) return
    continueComputerGame(events, service, game.id, reconnectTimeoutMs)
  })
}

export function continueComputerGame(
  events: GameEventsPublisher,
  service: GameService,
  gameId: string,
  reconnectTimeoutMs?: number
): void {
  const game = service.getGame(gameId)
  if (!game || !game.gameIsStarted || game.gameIsEnded) return

  if (hasDisconnectedHuman(game)) {
    cancelComputerMove(gameId)
    const existingTimer = reconnectTimers.get(gameId)
    if (existingTimer && reconnectTimeoutMs === undefined) return
    if (existingTimer) clearTimeout(existingTimer)
    const timer = setTimeout(() => {
      reconnectTimers.delete(gameId)
      const currentGame = service.getGame(gameId)
      if (!currentGame || !hasDisconnectedHuman(currentGame)) return
      deleteComputerGame(events, service, gameId, 'players did not reconnect')
    }, reconnectTimeoutMs ?? PLAYER_RECONNECT_TIMEOUT_MS)
    reconnectTimers.set(gameId, timer)
    return
  }

  const reconnectTimer = reconnectTimers.get(gameId)
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimers.delete(gameId)

  if (!game.currentPlayer) {
    deleteComputerGame(events, service, gameId, 'missing current player')
    return
  }

  if (isComputerPlayer(game.currentPlayer)) {
    scheduleComputerMove(events, service, gameId)
  }
}

function deleteComputerGame(
  events: GameEventsPublisher,
  service: GameService,
  gameId: string,
  reason: string
): void {
  cancelComputerMove(gameId)
  const reconnectTimer = reconnectTimers.get(gameId)
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimers.delete(gameId)

  void service
    .deleteGame(gameId)
    .then(() => {
      events.publishGameDeleted(gameId)
      events.publishGamesList(service.formatGamesList())
    })
    .catch((error: unknown) => {
      console.error(`Failed to delete computer game (${reason}):`, error)
    })
}

/** Ошибка записи партии в хранилище, отличная от сбоя самой логики хода. */
class GameSaveError extends Error {
  constructor(gameId: string, cause: unknown) {
    super(`Failed to save game ${gameId}`, { cause })
    this.name = 'GameSaveError'
  }
}

async function saveGameOrThrow(
  service: GameService,
  gameId: string
): Promise<void> {
  try {
    await service.saveGame(gameId)
  } catch (error) {
    throw new GameSaveError(gameId, error)
  }
}

/**
 * Таймеры уже запланированных цепочек компьютерных ходов по играм.
 * Нужно, чтобы `maybeContinueWithComputerMove`, вызываемый после каждого
 * действия человека (placeTile/placeFollower/skipFollower), не запускал
 * несколько параллельных цепочек для одной игры: они начинают гонку
 * за один и тот же ход и могут разместить один тайл несколько раз.
 */
const pendingMoveTimers = new Map<string, NodeJS.Timeout>()
const runningMoveChains = new Set<string>()
const reconnectTimers = new Map<string, NodeJS.Timeout>()

function hasDisconnectedHuman(game: IGameBoard): boolean {
  return game.players.some(
    (player) => Boolean(player.deviceId) && !player.socketId
  )
}

export function cancelComputerMove(gameId: string): void {
  const timer = pendingMoveTimers.get(gameId)
  if (timer) clearTimeout(timer)
  pendingMoveTimers.delete(gameId)
}

export function cancelAllComputerMoves(gameIds: string[]): void {
  gameIds.forEach(cancelComputerMove)
}

/** Запускает ход компьютера с небольшой задержкой */
export function scheduleComputerMove(
  events: GameEventsPublisher,
  service: GameService,
  gameId: string,
  delay = COMPUTER_MOVE_DELAY_MS
): void {
  if (pendingMoveTimers.has(gameId) || runningMoveChains.has(gameId)) return

  const timer = setTimeout(() => {
    pendingMoveTimers.delete(gameId)
    void runComputerMoves(events, service, gameId)
  }, delay)

  pendingMoveTimers.set(gameId, timer)
}

/**
 * Если после хода человека очередь перешла к компьютеру —
 * планируем автоматический ход.
 */
export function maybeContinueWithComputerMove(
  events: GameEventsPublisher,
  service: GameService,
  game: IGameBoard,
  gameId: string
): void {
  const currentPlayer = game.currentPlayer
  // После размещения тайла ход всё ещё может принадлежать человеку, если он
  // должен выставить фишку. Не запускаем компьютер до фактической передачи хода.
  if (currentPlayer && isComputerPlayer(currentPlayer)) {
    continueComputerGame(events, service, gameId)
  }
}

/** Проигрывает ходы компьютера подряд, пока очередь не перейдёт человеку */
export async function runComputerMoves(
  events: GameEventsPublisher,
  service: GameService,
  gameId: string
): Promise<void> {
  if (runningMoveChains.has(gameId)) return
  const game = service.getGame(gameId)
  if (!game || game.gameIsEnded || !game.currentPlayer) return
  if (!isComputerPlayer(game.currentPlayer)) return
  if (hasDisconnectedHuman(game)) {
    continueComputerGame(events, service, gameId)
    return
  }

  runningMoveChains.add(gameId)
  let failed = false
  try {
    await processComputerMoves(events, service, gameId)
  } catch (error) {
    failed = true
    if (error instanceof GameSaveError) {
      // Хранилище недоступно: ход уже откатан в playComputerMove, но
      // партию игроков удалять нельзя — она переживёт восстановление связи.
      console.error('Failed to save computer move:', error)
      events.publishGameError(gameId, 'Не удалось сохранить ход компьютера')
    } else {
      console.error('Failed to continue computer game:', error)
      deleteComputerGame(events, service, gameId, 'move failed')
    }
  } finally {
    runningMoveChains.delete(gameId)
    const currentGame = service.getGame(gameId)
    if (
      !failed &&
      currentGame?.currentPlayer &&
      isComputerPlayer(currentGame.currentPlayer) &&
      !currentGame.gameIsEnded &&
      !pendingMoveTimers.has(gameId)
    ) {
      continueComputerGame(events, service, gameId)
    }
  }
}

async function processComputerMoves(
  events: GameEventsPublisher,
  service: GameService,
  gameId: string
): Promise<void> {
  const game = service.getGame(gameId)
  if (!game || game.gameIsEnded || !game.currentPlayer) return
  if (hasDisconnectedHuman(game)) {
    continueComputerGame(events, service, gameId)
    return
  }

  // Ход ИИ идёт через ту же очередь, что и команды человека: снимок для
  // отката берётся уже под мьютексом, поэтому параллельный ход игрока не
  // может быть затёрт откатом. Пауза между ходами очередь не держит.
  for (;;) {
    const nextIsComputer = await service.runGameCommand(gameId, () =>
      playComputerMove(events, service, gameId)
    )
    if (!nextIsComputer) return
    await sleep(COMPUTER_MOVE_DELAY_MS)
  }
}

/**
 * Один ход компьютера: разыгрывание, проверка результата и сохранение.
 * Возвращает `true`, если очередь перешла к следующему компьютеру.
 * Вызывается из `runGameCommand`, поэтому внутри нельзя ждать другие команды.
 */
async function playComputerMove(
  events: GameEventsPublisher,
  service: GameService,
  gameId: string
): Promise<boolean> {
  const game = service.getGame(gameId)
  if (!game || game.gameIsEnded || !game.currentPlayer) return false
  if (hasDisconnectedHuman(game)) {
    continueComputerGame(events, service, gameId)
    return false
  }

  // Игрок, чей ход разыгрывается, определяется на каждом ходе заново: после
  // предыдущего хода очередь уже сдвинулась.
  const activePlayerId: PlayerId = game.currentPlayer.id
  const previousState = game.clone()
  const previousTileCount = countPlacedTiles(game)
  const isDragonMove = Boolean(game.dragonMove)

  try {
    await game.autoPlaceTile()

    // autoPlaceTile ждёт, а партию за это время могли заменить или удалить.
    const updatedGame = service.getGame(gameId)
    if (!updatedGame) return false
    if (hasDisconnectedHuman(updatedGame)) {
      updatedGame.copyStateFrom(previousState)
      continueComputerGame(events, service, gameId)
      return false
    }
    if (
      !isDragonMove &&
      !updatedGame.gameIsEnded &&
      countPlacedTiles(updatedGame) === previousTileCount
    ) {
      throw new Error('Computer move did not place a tile or end the game')
    }

    await saveGameOrThrow(service, gameId)

    // Сохранение тоже ждёт: за это время очередь могла перейти к человеку,
    // который успел сделать ход. Публикуем ровно то, что лежит в хранилище.
    const savedGame = service.getGame(gameId)
    if (!savedGame) return false
    events.publishGameUpdated(gameId, service.formatGameData(savedGame))

    if (savedGame.gameIsEnded) {
      events.publishGamesList(service.formatGamesList())
      return false
    }

    const nextPlayer = savedGame.getNextPlayer(activePlayerId)
    return Boolean(nextPlayer && isComputerPlayer(nextPlayer))
  } catch (error) {
    game.copyStateFrom(previousState)
    events.publishGameError(gameId, 'Error processing computer move')
    throw error
  }
}

function countPlacedTiles(game: IGameBoard): number {
  return Object.values(game.tilePlacesStats).reduce(
    (count, row) => count + Object.keys(row).length,
    0
  )
}
