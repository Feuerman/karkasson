export const NotificationType = {
  Success: 'success',
  Error: 'error',
  Warning: 'warning',
  Info: 'info',
} as const

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType]

export interface NotificationOptions {
  /** Короткий заголовок; сам текст уходит в описание. */
  title?: string
  /** Не скрывать уведомление автоматически. */
  sticky?: boolean
  /** Время показа в миллисекундах; по умолчанию зависит от типа. */
  duration?: number
}

export interface NotificationBridge {
  show(
    type: NotificationType,
    message: string,
    options?: NotificationOptions
  ): void
}

let bridge: NotificationBridge | null = null

export const registerNotificationBridge = (
  b: NotificationBridge | null
): (() => void) => {
  bridge = b
  return () => {
    if (bridge === b) {
      bridge = null
    }
  }
}

/** Отключает уведомления: показывать их больше некуда. */
export const unregisterNotificationBridge = (): void => {
  bridge = null
}

const notify = (
  type: NotificationType,
  message: string,
  options?: NotificationOptions
) => {
  bridge?.show(type, message, options)
}

/**
 * Причина отказа читается медленнее обычной подсказки, поэтому ошибка держится на
 * экране заметно дольше. При наведении мыши отсчёт приостанавливается, чтобы
 * успеть прочитать текст, и продолжается после ухода курсора.
 */
const ERROR_DURATION = 10000

/**
 * Ошибки показываются отдельным крупным уведомлением с заголовком и причиной:
 * игрок должен успеть прочитать, что именно запрещено правилами.
 */
const notificationService = {
  success: (message: string, options?: NotificationOptions) =>
    notify(NotificationType.Success, message, options),
  error: (message: string, options?: NotificationOptions) =>
    notify(NotificationType.Error, message, {
      title: 'Ошибка',
      duration: ERROR_DURATION,
      ...options,
    }),
  warning: (message: string, options?: NotificationOptions) =>
    notify(NotificationType.Warning, message, options),
  info: (message: string, options?: NotificationOptions) =>
    notify(NotificationType.Info, message, options),
}

export default notificationService
