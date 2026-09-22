<template>
  <div class="fixed right-5 top-5 z-[9999] flex flex-col gap-2.5">
    <TransitionGroup
      enter-active-class="transition-all duration-300 ease"
      enter-from-class="translate-x-[30px] opacity-0"
      enter-to-class="translate-x-0 opacity-100"
      leave-active-class="transition-all duration-300 ease"
      leave-from-class="translate-x-0 opacity-100"
      leave-to-class="translate-x-[30px] opacity-0"
    >
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="min-w-[200px] rounded px-6 py-3 text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-300 ease"
        :class="typeClass(notification.type)"
      >
        {{ notification.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

interface Notification {
  id: number
  message: string
  type: NotificationType
  duration: number
}

const notifications = ref<Notification[]>([])
let nextId = 1

const typeClassMap: Record<NotificationType, string> = {
  success: 'bg-success',
  error: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-primary',
}

const typeClass = (type: NotificationType): string =>
  typeClassMap[type] ?? typeClassMap.info

const addNotification = (
  message: string,
  type: NotificationType = 'info',
  duration: number = 3000
) => {
  const id = nextId++
  notifications.value.push({ id, message, type, duration })

  setTimeout(() => {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }, duration)
}

// Expose the addNotification function globally
defineExpose({
  addNotification,
})
</script>
