<script setup lang="ts">
import { useToast } from '@nuxt/ui/composables'
import { registerNotificationBridge } from '@/plugins/notification'
import type { NotificationType } from '@/plugins/notification'

const { add } = useToast()

const colorMap: Record<
  NotificationType,
  'success' | 'error' | 'warning' | 'info'
> = {
  success: 'success',
  error: 'error',
  warning: 'warning',
  info: 'info',
}

const iconMap: Record<NotificationType, string> = {
  success: 'i-lucide-circle-check',
  error: 'i-lucide-circle-x',
  warning: 'i-lucide-triangle-alert',
  info: 'i-lucide-info',
}

registerNotificationBridge({
  show(type, message, duration = 3000) {
    add({
      title: message,
      color: colorMap[type],
      icon: iconMap[type],
      duration,
    })
  },
})
</script>

<template>
  <span class="hidden" />
</template>
