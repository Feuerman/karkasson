import type { GameManager } from '../../modules/GameManager'
import { CommonErrors, GameErrors } from '../../modules/errors'
import type { SocketEvent } from '../../modules/types'
import { createLogger, runWithContext } from '../../utils/logger'
import { metrics } from '../../metrics/registry'
import { randomUUID } from 'node:crypto'
import type { SocketCallback, SocketHandlerContext } from '../types'
import { errorResponse } from './errorResponse'
import { toPlayerError } from './playerErrors'
import { ackGameUpdated } from './shared'

const logger = createLogger('gameCommand')

const commandsTotal = metrics.counter(
  'game_commands_total',
  'Total number of processed game commands'
)
const commandDuration = metrics.histogram(
  'game_command_duration_seconds',
  'Game command duration in seconds'
)
const commandErrors = metrics.counter(
  'game_command_errors_total',
  'Total number of failed game commands'
)

type GameErrorMessage = (typeof GameErrors)[keyof typeof GameErrors]

/**
 * Проверка права и фазы хода, выполняемая до снимка состояния.
 * Возвращает текст ошибки или `undefined`, если команду можно выполнять.
 */
export type GameCommandGuard = (
  game: GameManager,
  socketId: string
) => GameErrorMessage | undefined

export interface GameCommandContext {
  readonly game: GameManager
}

export interface GameCommandRequest {
  gameId: string
  /** Имя команды для журнала: по нему видно, какая именно команда отклонена. */
  command: SocketEvent
  /**
   * Необязательный клиентский ключ идемпотентности. Повтор с тем же ключом
   * после таймаута ack возвращает текущее состояние, но не применяет ход снова.
   */
  commandId?: string
  callback?: SocketCallback
  /** По умолчанию — «сейчас ход вызывающего». */
  guard?: GameCommandGuard
  /**
   * Изменение партии. Проверки и сама правка — здесь; сохранение, откат и
   * публикация делает общий исполнитель сервиса.
   */
  execute(context: GameCommandContext): Promise<void>
  /** Действия после сохранения и подтверждения: например, передача хода компьютеру. */
  afterSave?(game: GameManager): void
  /**
   * Транзиентная команда: состояние меняется в памяти и расходится игрокам,
   * но не сохраняется. Так работает предпросмотр — поворот тайла и выбор
   * клетки: на правила он не влияет и переживать перезапуск сервера не должен.
   */
  transient?: boolean
}

/**
 * Отказ команды с дополнительными полями ack: например, список конфликтов
 * сторон при неудачном размещении тайла.
 */
export class GameCommandError extends Error {
  readonly details: Record<string, unknown>

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'GameCommandError'
    this.details = details
  }
}

function commandErrorDetails(error: unknown): Record<string, unknown> {
  return error instanceof GameCommandError ? error.details : {}
}

function playerIndexesForSocket(game: GameManager, socketId: string): number[] {
  return game.players.reduce<number[]>((acc, player, index) => {
    if (player.socketId === socketId) acc.push(index)
    return acc
  }, [])
}

export function isPlayersTurn(game: GameManager, socketId: string): boolean {
  return playerIndexesForSocket(game, socketId).some(
    (index) => index === game.currentPlayerIndex
  )
}

/** Проверка по умолчанию: очередь принадлежит вызывающему сокету. */
const requirePlayersTurn: GameCommandGuard = (game, socketId) =>
  isPlayersTurn(game, socketId) ? undefined : GameErrors.NotPlayersTurn

/**
 * Общий преамбул изменяющих игровых команд: мьютекс партии → проверка права и
 * фазы → изменение → сохранение → публикация и ack.
 *
 * Изменение, сохранение и откат выполняет общий исполнитель сервиса: тот же
 * протокол использует ход компьютера, поэтому расхождение по откату и по
 * публикации невозможно.
 *
 * Отказ правил, случившийся уже после частичной мутации (поворот тайла,
 * потраченный ход), и ошибка сохранения обрабатываются одинаково: состояние
 * возвращается к снимку, а вызывающий получает ack с `error`.
 */
export async function runGameCommand(
  { events, service, socket }: SocketHandlerContext,
  {
    gameId,
    command,
    commandId,
    callback,
    guard = requirePlayersTurn,
    execute,
    afterSave,
    transient = false,
  }: GameCommandRequest
): Promise<void> {
  const requestId = randomUUID()
  const start = process.hrtime.bigint()
  commandsTotal.inc(1, { command })

  return runWithContext({ requestId, gameId, command }, async () => {
    try {
      const dedupeKey = commandId ? `${command}:${commandId}` : undefined

      await service.runGameCommand(gameId, async () => {
        const game = service.getGame(gameId)
        if (!game) {
          callback?.(errorResponse(CommonErrors.GameNotFound))
          return
        }

        const sessionId = service.getSessionBySocketId(socket.id)
        if (
          sessionId &&
          service.findSpectatorGamesForSession(sessionId).includes(gameId)
        ) {
          callback?.(errorResponse(CommonErrors.InvalidRequest))
          return
        }

        if (
          !transient &&
          dedupeKey &&
          service.isCommandCompleted(gameId, dedupeKey)
        ) {
          ackGameUpdated(events, gameId, game, callback)
          return
        }

        const guardError = guard(game, socket.id)
        if (guardError) {
          callback?.(errorResponse(guardError))
          return
        }

        const mutate = (currentGame: GameManager) =>
          execute({ game: currentGame })

        try {
          // Транзиентная команда меняет только предпросмотр: она не сохраняется и
          // не снимает снимок состояния — правка атомарна.
          if (transient) {
            await service.mutateWithoutSaving(gameId, mutate)
          } else {
            await service.mutateAndSave(gameId, mutate)
          }
        } catch (error) {
          logger.error(`Ошибка команды ${command}:`, error)
          commandErrors.inc(1, { command })
          callback?.({
            ...toPlayerError(error, service.getSessionLocale(socket.id)),
            ...commandErrorDetails(error),
          })
          return
        }

        if (!transient && dedupeKey) {
          service.rememberCompletedCommand(gameId, dedupeKey)
        }
        ackGameUpdated(events, gameId, game, callback)
        afterSave?.(game)
      })
    } finally {
      commandDuration.observe(Number(process.hrtime.bigint() - start) / 1e9)
    }
  })
}
