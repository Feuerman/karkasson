import { COMPUTER_MOVE_DELAY_MS, PLAYER_RECONNECT_TIMEOUT_MS } from '../config'
import type { GameManager } from '../modules/GameManager'
import { GameSaveError, MutationCancelled } from '../modules/errors'
import { type Player, type PlayerId } from '../modules/types'
import { sleep } from '../utils/common'
import { createLogger } from '../utils/logger'
import type { GameService } from './GameService'
import type { GameEventsPublisher } from './gameEvents'
import { formatGameData } from './gameView'

const logger = createLogger('computerPlayer')

export function isComputerPlayer(player: Player): boolean {
  return !player.socketId && !player.deviceId
}

/**
 * Планировщик ходов компьютера.
 *
 * Таймеры и цепочки ходов живут в экземпляре, а не в модуле: сервер можно
 * поднять в нескольких экземплярах, а состояние планировщика — изолировать
 * в тестах.
 */
export class ComputerMoveScheduler {
  /**
   * Таймеры уже запланированных цепочек компьютерных ходов по играм.
   * Нужно, чтобы `maybeContinue`, вызываемый после каждого действия человека
   * (placeTile/placeFollower/skipFollower), не запускал несколько параллельных
   * цепочек для одной игры: они начинают гонку за один и тот же ход и могут
   * разместить один тайл несколько раз.
   */
  private readonly pendingMoveTimers = new Map<string, NodeJS.Timeout>()
  private readonly runningMoveChains = new Set<string>()
  private readonly reconnectTimers = new Map<string, NodeJS.Timeout>()

  /** Возобновляет ходы компьютера во всех партиях после перезапуска сервера. */
  resumeAll(
    events: GameEventsPublisher,
    service: GameService,
    reconnectTimeoutMs?: number
  ): void {
    service.allGames().forEach((game) => {
      if (!game.id) return
      if (!game.gameIsStarted || game.gameIsEnded) return
      this.continueGame(events, service, game.id, reconnectTimeoutMs)
    })
  }

  /**
   * Продолжает партию: если ход принадлежит компьютеру, ход запланирован, а
   * если один из игроков отключился — ждём переподключения.
   */
  continueGame(
    events: GameEventsPublisher,
    service: GameService,
    gameId: string,
    reconnectTimeoutMs?: number
  ): void {
    const game = service.getGame(gameId)
    if (!game || !game.gameIsStarted || game.gameIsEnded) return

    if (this.hasDisconnectedHuman(game)) {
      this.cancelMove(gameId)
      const existingTimer = this.reconnectTimers.get(gameId)
      if (existingTimer && reconnectTimeoutMs === undefined) return
      if (existingTimer) clearTimeout(existingTimer)
      const timer = setTimeout(() => {
        this.reconnectTimers.delete(gameId)
        const currentGame = service.getGame(gameId)
        if (!currentGame || !this.hasDisconnectedHuman(currentGame)) return
        this.deleteComputerGame(
          events,
          service,
          gameId,
          'players did not reconnect'
        )
      }, reconnectTimeoutMs ?? PLAYER_RECONNECT_TIMEOUT_MS)
      this.reconnectTimers.set(gameId, timer)
      return
    }

    const reconnectTimer = this.reconnectTimers.get(gameId)
    if (reconnectTimer) clearTimeout(reconnectTimer)
    this.reconnectTimers.delete(gameId)

    if (!game.currentPlayer) {
      this.deleteComputerGame(events, service, gameId, 'missing current player')
      return
    }

    if (isComputerPlayer(game.currentPlayer)) {
      this.scheduleMove(events, service, gameId)
    }
  }

  /** Отменяет запланированный ход компьютера по партии. */
  cancelMove(gameId: string): void {
    const timer = this.pendingMoveTimers.get(gameId)
    if (timer) clearTimeout(timer)
    this.pendingMoveTimers.delete(gameId)
  }

  /** Отменяет запланированные ходы компьютера по указанным партиям. */
  cancelAll(gameIds: string[]): void {
    gameIds.forEach((gameId) => this.cancelMove(gameId))
  }

  /** Запускает ход компьютера с небольшой задержкой */
  scheduleMove(
    events: GameEventsPublisher,
    service: GameService,
    gameId: string,
    delay = COMPUTER_MOVE_DELAY_MS
  ): void {
    if (
      this.pendingMoveTimers.has(gameId) ||
      this.runningMoveChains.has(gameId)
    ) {
      return
    }

    const timer = setTimeout(() => {
      this.pendingMoveTimers.delete(gameId)
      void this.runMoves(events, service, gameId)
    }, delay)

    this.pendingMoveTimers.set(gameId, timer)
  }

  /**
   * Если после хода человека очередь перешла к компьютеру —
   * планируем автоматический ход.
   */
  maybeContinue(
    events: GameEventsPublisher,
    service: GameService,
    game: GameManager,
    gameId: string
  ): void {
    const currentPlayer = game.currentPlayer
    // После размещения тайла ход всё ещё может принадлежать человеку, если он
    // должен выставить фишку. Не запускаем компьютер до фактической передачи хода.
    if (currentPlayer && isComputerPlayer(currentPlayer)) {
      this.continueGame(events, service, gameId)
    }
  }

  /** Проигрывает ходы компьютера подряд, пока очередь не перейдёт человеку */
  async runMoves(
    events: GameEventsPublisher,
    service: GameService,
    gameId: string
  ): Promise<void> {
    if (this.runningMoveChains.has(gameId)) return
    const game = service.getGame(gameId)
    if (!game || game.gameIsEnded || !game.currentPlayer) return
    if (!isComputerPlayer(game.currentPlayer)) return
    if (this.hasDisconnectedHuman(game)) {
      this.continueGame(events, service, gameId)
      return
    }

    this.runningMoveChains.add(gameId)
    let failed = false
    try {
      await this.processMoves(events, service, gameId)
    } catch (error) {
      failed = true
      if (error instanceof GameSaveError) {
        // Хранилище недоступно: ход уже откатан в playComputerMove, но
        // партию игроков удалять нельзя — она переживёт восстановление связи.
        logger.error('Failed to save computer move:', error)
        events.publishGameError(gameId, 'Не удалось сохранить ход компьютера')
      } else {
        logger.error('Failed to continue computer game:', error)
        this.deleteComputerGame(events, service, gameId, 'move failed')
      }
    } finally {
      this.runningMoveChains.delete(gameId)
      const currentGame = service.getGame(gameId)
      if (
        !failed &&
        currentGame?.currentPlayer &&
        isComputerPlayer(currentGame.currentPlayer) &&
        !currentGame.gameIsEnded &&
        !this.pendingMoveTimers.has(gameId)
      ) {
        this.continueGame(events, service, gameId)
      }
    }
  }

  private deleteComputerGame(
    events: GameEventsPublisher,
    service: GameService,
    gameId: string,
    reason: string
  ): void {
    this.cancelMove(gameId)
    const reconnectTimer = this.reconnectTimers.get(gameId)
    if (reconnectTimer) clearTimeout(reconnectTimer)
    this.reconnectTimers.delete(gameId)

    void service
      .deleteGame(gameId)
      .then(() => {
        events.publishGameDeleted(gameId)
        events.publishGamesList(service.formatGamesList())
      })
      .catch((error: unknown) => {
        logger.error(`Failed to delete computer game (${reason}):`, error)
      })
  }

  private hasDisconnectedHuman(game: GameManager): boolean {
    return game.players.some(
      (player) => Boolean(player.deviceId) && !player.socketId
    )
  }

  private async processMoves(
    events: GameEventsPublisher,
    service: GameService,
    gameId: string
  ): Promise<void> {
    const game = service.getGame(gameId)
    if (!game || game.gameIsEnded || !game.currentPlayer) return
    if (this.hasDisconnectedHuman(game)) {
      this.continueGame(events, service, gameId)
      return
    }

    // Ход ИИ идёт через ту же очередь, что и команды человека: снимок для
    // отката берётся уже под мьютексом, поэтому параллельный ход игрока не
    // может быть затёрт откатом. Пауза между ходами очередь не держит.
    for (;;) {
      const nextIsComputer = await service.runGameCommand(gameId, () =>
        this.playMove(events, service, gameId)
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
  private async playMove(
    events: GameEventsPublisher,
    service: GameService,
    gameId: string
  ): Promise<boolean> {
    const game = service.getGame(gameId)
    if (!game || game.gameIsEnded || !game.currentPlayer) return false
    if (this.hasDisconnectedHuman(game)) {
      this.continueGame(events, service, gameId)
      return false
    }

    // Игрок, чей ход разыгрывается, определяется на каждом ходе заново: после
    // предыдущего хода очередь уже сдвинулась.
    const activePlayerId: PlayerId = game.currentPlayer.id
    const previousTileCount = countPlacedTiles(game)
    const isDragonMove = Boolean(game.dragonMove)

    try {
      return await service.mutateAndSave(
        gameId,
        async (currentGame) => {
          await currentGame.autoPlaceTile()

          // autoPlaceTile ждёт, а партию за это время могли заменить или удалить.
          const updatedGame = service.getGame(gameId)
          if (!updatedGame) return false
          if (this.hasDisconnectedHuman(updatedGame)) {
            // Игрок отключился: ход отменяется целиком, партия ждёт его.
            throw new MutationCancelled(
              'player disconnected during computer move'
            )
          }
          if (
            !isDragonMove &&
            !updatedGame.gameIsEnded &&
            countPlacedTiles(updatedGame) === previousTileCount
          ) {
            throw new Error(
              'Computer move did not place a tile or end the game'
            )
          }

          const savedGame = service.getGame(gameId)
          if (!savedGame) return false
          if (savedGame.gameIsEnded) {
            events.publishGamesList(service.formatGamesList())
            return false
          }

          const nextPlayer = savedGame.getNextPlayer(activePlayerId)
          return Boolean(nextPlayer && isComputerPlayer(nextPlayer))
        },
        (savedGame) => {
          // Публикуем ровно то, что лежит в хранилище: сохранение тоже ждёт,
          // и за это время очередь могла перейти к человеку.
          events.publishGameUpdated(gameId, formatGameData(savedGame))
        }
      )
    } catch (error) {
      if (error instanceof MutationCancelled) {
        this.continueGame(events, service, gameId)
        return false
      }
      events.publishGameError(gameId, 'Не удалось выполнить ход компьютера')
      throw error
    }
  }
}

function countPlacedTiles(game: GameManager): number {
  return Object.values(game.tilePlacesStats).reduce(
    (count, row) => count + Object.keys(row).length,
    0
  )
}
