<script setup lang="ts">
import { useToast } from '@nuxt/ui/composables'
import { registerNotificationBridge } from '@/plugins/notification'
import {
  NotificationType,
  type NotificationType as NotificationTypeValue,
} from '@/plugins/notification'

const { add } = useToast()

const colorMap: Record<NotificationTypeValue, NotificationTypeValue> = {
  [NotificationType.Success]: NotificationType.Success,
  [NotificationType.Error]: NotificationType.Error,
  [NotificationType.Warning]: NotificationType.Warning,
  [NotificationType.Info]: NotificationType.Info,
}

const iconMap: Record<NotificationType, string> = {
  [NotificationType.Success]: 'i-lucide-circle-check',
  [NotificationType.Error]: 'i-lucide-circle-x',
  [NotificationType.Warning]: 'i-lucide-triangle-alert',
  [NotificationType.Info]: 'i-lucide-info',
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
