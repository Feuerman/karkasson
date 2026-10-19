<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { useToast } from '@nuxt/ui/composables'
import {
  NotificationType,
  registerNotificationBridge,
  type NotificationOptions,
  type NotificationType as NotificationTypeValue,
} from '@/plugins/notification'

const { add, toasts, update } = useToast()

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

/**
 * Ошибка всегда одна и та же: новая причина заменяет предыдущую, чтобы
 * уведомления не накапливались на экране. Таймер идёт на фоне, но при наведении
 * мыши приостанавливается и продолжает отсчёт после ухода курсора.
 */
const ERROR_TOAST_ID = 'app-error'

/** Крупное оформление: причина отказа должна читаться с одного взгляда. */
const errorUi = {
  root: 'gap-4 p-5 sm:pr-14 shadow-xl',
  title: 'text-lg font-semibold',
  description: 'text-base leading-relaxed',
  icon: 'size-7',
  close: 'p-1.5 -me-2.5 -mt-1.5',
}

const DEFAULT_DURATION = 3000

/**
 * Клик по уведомлению оставляет фокус внутри него, и тогда таймер не
 * возобновляется после ухода мыши: снятие фокуса возвращает отсчёт, а следующее
 * движение курсора над уведомлением снова его приостанавливает.
 */
const releaseToastFocus = (): void => {
  const activeElement = document.activeElement
  if (activeElement instanceof HTMLElement) {
    activeElement.blur()
  }
}

const unregisterNotificationBridge = registerNotificationBridge({
  show(type, message, options: NotificationOptions = {}) {
    const isError = type === NotificationType.Error
    const sticky = options.sticky ?? false
    const title = options.title ?? (isError ? 'Ошибка' : undefined)
    const toast = {
      title: title ?? message,
      ...(title ? { description: message } : {}),
      color: colorMap[type],
      icon: iconMap[type],
      duration: options.duration ?? (sticky ? 0 : DEFAULT_DURATION),
      progress: !sticky,
      onClick: releaseToastFocus,
      ...(isError ? { ui: errorUi } : {}),
    }

    // Обновление вместо добавления: закрытую и удалённую ошибку add() мог бы
    // не открыть заново, а update() показывает сообщение в любом случае.
    if (toasts.value.some(({ id }) => id === ERROR_TOAST_ID)) {
      update(ERROR_TOAST_ID, toast)
      return
    }
    add(isError ? { ...toast, id: ERROR_TOAST_ID } : toast)
  },
})

onBeforeUnmount(unregisterNotificationBridge)
</script>

<template>
  <span class="hidden" />
</template>
