import { COMPUTER_MOVE_DELAY_MS, COMPUTER_MOVE_WATCHDOG_MS } from '../config'
import type { GameManager } from '../modules/GameManager'
import { GameSaveError, MutationCancelled } from '../modules/errors'
import { type Player, type PlayerId } from '../modules/types'
import { sleep } from '../utils/common'
import { createLogger } from '../utils/logger'
import type { GameService } from './GameService'
import type { GameEventsPublisher } from './gameEvents'
import { formatGameData } from './gameView'

const logger = createLogger('computerPlayer')

/** Ход компьютера не уложился в watchdog: партия уже удалена планировщиком. */
class ComputerMoveTimeoutError extends Error {
  constructor(gameId: string) {
    super(`Computer move timed out for game ${gameId}`)
    this.name = 'ComputerMoveTimeoutError'
  }
}

export function isComputerPlayer(player: Player): boolean {
  return !player.socketId && !player.sessionId
}

function isComputerOnlyGame(game: GameManager): boolean {
  return game.players.length > 0 && game.players.every(isComputerPlayer)
}

export interface ComputerMoveSchedulerOptions {
  /** Пауза перед ходом компьютера. */
  moveDelayMs?: number
  /** Сколько может длиться один ход до срабатывания watchdog. */
  watchdogTimeoutMs?: number
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
  /**
   * Партии, ход которых прерван watchdog. Их нельзя возобновлять: состояние
   * могло быть частично изменено фоновой задачей, а игрок уже получил отказ.
   */
  private readonly haltedGames = new Set<string>()
  private readonly moveDelayMs: number
  private readonly watchdogTimeoutMs: number

  constructor(options: ComputerMoveSchedulerOptions = {}) {
    this.moveDelayMs = options.moveDelayMs ?? COMPUTER_MOVE_DELAY_MS
    this.watchdogTimeoutMs =
      options.watchdogTimeoutMs ?? COMPUTER_MOVE_WATCHDOG_MS
  }

  /**
   * Возобновляет ходы компьютера во всех партиях после перезапуска сервера.
   *
   * Полностью автоматические партии некому наблюдать: после рестарта у них нет
   * владельца и подключённых людей. Их число ограничено тем же глобальным
   * пределом, что и запуск новых, а лишние удаляются, чтобы не занимать память
   * и цикл событий бесконечно.
   */
  async resumeAll(
    events: GameEventsPublisher,
    service: GameService
  ): Promise<void> {
    const activeGames = service
      .allGames()
      .filter((game) => game.id && game.gameIsStarted && !game.gameIsEnded)
    const aiGames = activeGames.filter(isComputerOnlyGame)
    const humanGames = activeGames.filter((game) => !isComputerOnlyGame(game))

    humanGames.forEach((game) => {
      if (game.id) this.continueGame(events, service, game.id)
    })

    const limit = service.activeAiGameLimit()
    for (const game of aiGames.slice(0, limit)) {
      if (game.id) this.continueGame(events, service, game.id)
    }

    const excessGames = aiGames.slice(limit)
    if (excessGames.length > 0) {
      logger.warn(
        `Removing ${excessGames.length} AI-only game(s) after restart: ` +
          `active AI game limit is ${limit}`
      )
    }
    for (const game of excessGames) {
      if (!game.id) continue
      try {
        await service.deleteGame(game.id)
        events.publishGameDeleted(game.id, 'stale')
      } catch (error: unknown) {
        logger.error(`Failed to remove excess AI game ${game.id}:`, error)
      }
    }
    if (excessGames.length > 0) {
      events.publishGamesList(service.formatGamesList())
    }
  }

  /**
   * Продолжает партию: если ход принадлежит компьютеру, ход запланирован, а
   * если один из игроков отключился — партия ждёт переподключения. Удаление
   * заброшенной партии делает общая очистка по сроку, а не таймер игрока:
   * короткое отключение не должно уничтожать сохранение.
   */
  continueGame(
    events: GameEventsPublisher,
    service: GameService,
    gameId: string
  ): void {
    if (this.haltedGames.has(gameId)) return

    const game = service.getGame(gameId)
    if (!game || !game.gameIsStarted || game.gameIsEnded) return

    if (this.hasDisconnectedHuman(game)) {
      this.cancelMove(gameId)
      return
    }

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
    delay?: number
  ): void {
    if (this.haltedGames.has(gameId)) return
    if (
      this.pendingMoveTimers.has(gameId) ||
      this.runningMoveChains.has(gameId)
    ) {
      return
    }

    const timer = setTimeout(() => {
      this.pendingMoveTimers.delete(gameId)
      void this.runMoves(events, service, gameId)
    }, delay ?? this.moveDelayMs)

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
    if (this.haltedGames.has(gameId)) return
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
      if (error instanceof ComputerMoveTimeoutError) {
        // Watchdog уже удалил партию и сообщил игрокам; повторять удаление и
        // запускать следующие ходы нельзя.
        return
      }
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
        !this.haltedGames.has(gameId) &&
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

    void service
      .deleteGame(gameId)
      .then(() => {
        events.publishGameDeleted(gameId, 'failed')
        events.publishGamesList(service.formatGamesList())
      })
      .catch((error: unknown) => {
        logger.error(`Failed to delete computer game (${reason}):`, error)
      })
  }

  private hasDisconnectedHuman(game: GameManager): boolean {
    return game.players.some(
      (player) => Boolean(player.sessionId) && !player.socketId
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
        this.runWithWatchdog(events, service, gameId, () =>
          this.playMove(events, service, gameId)
        )
      )
      if (!nextIsComputer) return
      await sleep(this.moveDelayMs)
    }
  }

  /**
   * Ограничивает один ход компьютера по времени. Watchdog не может прервать
   * синхронный расчёт, зато не даёт зависшему ожиданию (например, хранилищу)
   * оставить партию заблокированной навсегда.
   */
  private runWithWatchdog<T>(
    events: GameEventsPublisher,
    service: GameService,
    gameId: string,
    task: () => Promise<T>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.haltedGames.add(gameId)
        this.cancelMove(gameId)
        logger.error(`Computer move watchdog timed out for game ${gameId}`)
        events.publishGameError(
          gameId,
          'Ход компьютера занял слишком много времени'
        )
        void service
          .deleteGame(gameId)
          .then(() => {
            events.publishGameDeleted(gameId, 'failed')
            events.publishGamesList(service.formatGamesList())
          })
          .catch((error: unknown) => {
            logger.error(
              `Failed to delete game after watchdog timeout (${gameId}):`,
              error
            )
          })
        reject(new ComputerMoveTimeoutError(gameId))
      }, this.watchdogTimeoutMs)

      task().then(
        (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        (error: unknown) => {
          clearTimeout(timer)
          reject(error)
        }
      )
    })
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
    const isFollowerAction = game.isPlacingFollower || game.isPlacingFairy

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
            !isFollowerAction &&
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
          // Партию могли удалить watchdog или остановка сервера: не рассылаем
          // событие об уже несуществующей игре.
          if (!service.getGame(gameId)) return
          // Публикуем дельту истории: все клиенты в комнате получают только
          // новые действия с момента последней рассылки.
          const fromIndex = savedGame.lastPublishedActionIndex
          const gameData = formatGameData(savedGame, {
            fromActionIndex: fromIndex,
          })
          events.publishGameUpdated(gameId, gameData)
          savedGame.lastPublishedActionIndex =
            savedGame.actionsHistory.length - 1
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
