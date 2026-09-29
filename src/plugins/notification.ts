export const NotificationType = {
  Success: 'success',
  Error: 'error',
  Warning: 'warning',
  Info: 'info',
} as const

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType]

export interface NotificationBridge {
  show(type: NotificationType, message: string, duration?: number): void
}

let bridge: NotificationBridge | null = null

export const registerNotificationBridge = (b: NotificationBridge): void => {
  bridge = b
}

const notify = (type: NotificationType, message: string, duration?: number) => {
  bridge?.show(type, message, duration)
}

const notificationService = {
  success: (message: string, duration?: number) =>
    notify(NotificationType.Success, message, duration),
  error: (message: string, duration?: number) =>
    notify(NotificationType.Error, message, duration),
  warning: (message: string, duration?: number) =>
    notify(NotificationType.Warning, message, duration),
  info: (message: string, duration?: number) =>
    notify(NotificationType.Info, message, duration),
}

export default notificationService
