import type { GameData, GameSummary } from './GameService'

/**
 * Публикация игровых событий для подключённых клиентов.
 *
 * Сервисный слой не знает о Socket.IO: реализация этого порта живёт в
 * транспортном слое и внедряется снаружи. Так ходы компьютера, сохранение и
 * сборка списка игр не зависят от способа доставки обновлений.
 */
export interface GameEventsPublisher {
  /** Рассылает новое состояние партии всем участникам комнаты `gameId`. */
  publishGameUpdated(gameId: string, game: GameData): void
  /** Сообщает участникам комнаты о неудаче хода, не обрывая их сессию. */
  publishGameError(gameId: string, message: string): void
  /** Уведомляет комнату, что партия удалена и её нужно покинуть. */
  publishGameDeleted(gameId: string): void
  /** Обновляет список партий у всех клиентов, включая наблюдателей лобби. */
  publishGamesList(games: GameSummary[]): void
}
