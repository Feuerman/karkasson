import { ComponentPublicInstance } from 'vue'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $notification: {
      success: (message: string, duration?: number) => void
      error: (message: string, duration?: number) => void
      warning: (message: string, duration?: number) => void
      info: (message: string, duration?: number) => void
    }
  }
}
