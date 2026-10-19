import type { IGameBoard } from '../../modules/GameManager'
import type { GameService } from '../../services/GameService'
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
  game: IGameBoard,
  socketId: string
) => GameErrorMessage | undefined

export interface GameCommandContext {
  readonly game: IGameBoard
  /** Сохраняет партию; при ошибке откатывает состояние к снимку. */
  save(): Promise<void>
  /** Публикует состояние игрокам и подтверждает команду вызывающему. */
  ack(): void
}

export interface GameCommandRequest {
  gameId: string
  /** Имя команды для журнала: по нему видно, какая именно команда отклонена. */
  command: SocketEvent
  callback?: SocketCallback
  /** По умолчанию — «сейчас ход вызывающего». */
  guard?: GameCommandGuard
  execute(context: GameCommandContext): Promise<void>
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

function playerIndexesForSocket(game: IGameBoard, socketId: string): number[] {
  return game.players.reduce<number[]>((acc, player, index) => {
    if (player.socketId === socketId) acc.push(index)
    return acc
  }, [])
}

export function isPlayersTurn(game: IGameBoard, socketId: string): boolean {
  return playerIndexesForSocket(game, socketId).some(
    (index) => index === game.currentPlayerIndex
  )
}

/** Проверка по умолчанию: очередь принадлежит вызывающему сокету. */
const requirePlayersTurn: GameCommandGuard = (game, socketId) =>
  isPlayersTurn(game, socketId) ? undefined : GameErrors.NotPlayersTurn

/**
 * Общий преамбул изменяющих игровых команд: мьютекс партии → проверка права и
 * фазы → снимок состояния → мутация → сохранение → публикация и ack.
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

    const previousState = game.clone()
    const context: GameCommandContext = {
      game,
      save: () => saveGameOrRollback(game, gameId, service, previousState),
      ack: () => ackGameUpdated(events, service, gameId, game, callback),
    }

    try {
      await execute(context)
    } catch (error) {
      game.copyStateFrom(previousState)
      logger.error(`Ошибка команды ${command}:`, error)
      callback?.({
        error: toPlayerErrorMessage(error),
        ...commandErrorDetails(error),
      })
    }
  })
}

/** Сохраняет партию; при ошибке записи откатывает состояние к снимку. */
async function saveGameOrRollback(
  game: IGameBoard,
  gameId: string,
  service: GameService,
  previousState: IGameBoard
): Promise<void> {
  try {
    await service.saveGame(gameId)
  } catch (error) {
    game.copyStateFrom(previousState)
    throw error
  }
}
