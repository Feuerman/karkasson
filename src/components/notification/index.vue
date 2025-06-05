<template>
  <div class="notifications-container">
    <TransitionGroup name="notification">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="notification"
        :class="notification.type"
      >
        {{ notification.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Notification {
  id: number
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration: number
}

const notifications = ref<Notification[]>([])
let nextId = 1

const addNotification = (
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
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

<style scoped lang="scss">
.notifications-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notification {
  padding: 12px 24px;
  border-radius: 4px;
  color: white;
  min-width: 200px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

  &.success {
    background-color: #4caf50;
  }

  &.error {
    background-color: #f44336;
  }

  &.warning {
    background-color: #ff9800;
  }

  &.info {
    background-color: #2196f3;
  }
}

.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
