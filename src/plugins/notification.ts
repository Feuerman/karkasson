export type NotificationType = 'success' | 'error' | 'warning' | 'info'

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
    notify('success', message, duration),
  error: (message: string, duration?: number) =>
    notify('error', message, duration),
  warning: (message: string, duration?: number) =>
    notify('warning', message, duration),
  info: (message: string, duration?: number) =>
    notify('info', message, duration),
}

export default notificationService
