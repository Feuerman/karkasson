import 'vue'
import type { NotificationOptions } from '../plugins/notification'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $notification: {
      success: (message: string, options?: NotificationOptions) => void
      error: (message: string, options?: NotificationOptions) => void
      warning: (message: string, options?: NotificationOptions) => void
      info: (message: string, options?: NotificationOptions) => void
    }
  }
}

export {}
