import type { GameManager } from '../../modules/GameManager'
import { CommonErrors, GameErrors } from '../../modules/errors'
import type { SocketEvent } from '../../modules/types'
import { createLogger } from '../../utils/logger'
import type { SocketCallback, SocketHandlerContext } from '../types'
import { toPlayerErrorMessage } from './playerErrors'
import { ackGameUpdated } from './shared'

const logger = createLogger('gameCommand')

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
    callback,
    guard = requirePlayersTurn,
    execute,
    afterSave,
    transient = false,
  }: GameCommandRequest
): Promise<void> {
  await service.runGameCommand(gameId, async () => {
    const game = service.getGame(gameId)
    if (!game) {
      callback?.({ error: CommonErrors.GameNotFound })
      return
    }

    const guardError = guard(game, socket.id)
    if (guardError) {
      callback?.({ error: guardError })
      return
    }

    const mutate = (currentGame: GameManager) => execute({ game: currentGame })

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
      callback?.({
        error: toPlayerErrorMessage(error),
        ...commandErrorDetails(error),
      })
      return
    }

    ackGameUpdated(events, gameId, game, callback)
    afterSave?.(game)
  })
}
