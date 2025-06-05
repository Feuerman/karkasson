import { App } from 'vue'
import { createVNode, render } from 'vue'
import NotificationComponent from '../components/notification/index.vue'

// Create a global notification service
const notificationService = {
  success: (message: string, duration?: number) => {
    notificationVNode.component?.exposed?.addNotification(
      message,
      'success',
      duration
    )
  },
  error: (message: string, duration?: number) => {
    notificationVNode.component?.exposed?.addNotification(
      message,
      'error',
      duration
    )
  },
  warning: (message: string, duration?: number) => {
    notificationVNode.component?.exposed?.addNotification(
      message,
      'warning',
      duration
    )
  },
  info: (message: string, duration?: number) => {
    notificationVNode.component?.exposed?.addNotification(
      message,
      'info',
      duration
    )
  },
}

// Create container and component instance
const container = document.createElement('div')
document.body.appendChild(container)
const notificationVNode = createVNode(NotificationComponent)
render(notificationVNode, container)

// Export the notification service
export default notificationService
